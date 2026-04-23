/**
 * Endpoint admin RPC per il DB: una sola route `_admin.db.rpc` dispatcha tutte le op.
 * Auth: bearer header `Authorization: Bearer <FWDB_ADMIN_PASSWORD>`.
 * L'endpoint risponde solo se:
 *   - `FWDB_ADMIN_ENABLED` = `"1"`
 *   - `FWDB_ADMIN_PASSWORD` è impostata e non vuota
 *   - header `Authorization` combacia (timing-safe)
 *
 * Il WAL binario (pull/push) non passa da qui: è gestito come route raw in `core/cli/dev` / `core/server/routes/serve.ts`.
 */
import { s } from "server";
import { db, applyCatalogJsonString, readCurrentCatalogJsonString, forceCheckpoint } from "db";
import { error } from "../../../core/server/error";
import { ValidationError, type InputSchema } from "../../../core/client/validator/properties/defs";
import type { TableOp } from "../../../core/db/remote/protocol";
import { assertAdminAuth } from "../../../core/db/remote/server-auth";

const opSchema: InputSchema<TableOp> = {
	parse(raw) {
		if (typeof raw !== "object" || raw === null) throw new ValidationError("expected object");
		const o = raw as Record<string, unknown>;
		const op = o.op;
		if (typeof op !== "string") throw new ValidationError("op required");
		switch (op) {
			case "table.find":
			case "table.findOpts":
			case "table.byId":
			case "table.count":
			case "table.countOpts":
			case "table.create":
			case "table.update":
			case "table.updateOpts":
			case "table.delete":
			case "table.deleteOpts":
			case "table.clear":
			case "db.clearAll":
			case "catalog.get":
			case "catalog.push":
			case "checkpoint":
				return raw as TableOp;
			default:
				throw new ValidationError(`unknown op: ${op}`);
		}
	},
};

export const rpc = s({
	input: opSchema,
	// Auth fatto a mano: non è una sessione, è un secret condiviso tramite env.
	async run(input, ctx) {
		assertAdminAuth(ctx.headers);

		switch (input.op) {
			case "table.find": {
				const acc = db.table(input.table as never);
				const rows = await acc.find(input.where as never, input.opts as never);
				return { ok: true as const, rows };
			}
			case "table.findOpts": {
				const acc = db.table(input.table as never);
				const rows = await acc.find(input.opts as never);
				return { ok: true as const, rows };
			}
			case "table.byId": {
				const acc = db.table(input.table as never);
				const row = await acc.byId(input.id);
				return { ok: true as const, row: row ?? null };
			}
			case "table.count": {
				const acc = db.table(input.table as never);
				const count = await acc.count(input.where as never);
				return { ok: true as const, count };
			}
			case "table.countOpts": {
				const acc = db.table(input.table as never);
				const count = await acc.count(input.opts as never);
				return { ok: true as const, count };
			}
			case "table.create": {
				const acc = db.table(input.table as never);
				const rows = await acc.create(input.rows as never);
				return { ok: true as const, rows };
			}
			case "table.update": {
				const acc = db.table(input.table as never);
				const result = await acc.update(input.where as never, input.patch as never);
				return { ok: true as const, result };
			}
			case "table.updateOpts": {
				const acc = db.table(input.table as never);
				const result = await acc.update(input.opts as never);
				return { ok: true as const, result };
			}
			case "table.delete": {
				const acc = db.table(input.table as never);
				const result = await acc.delete(input.where as never);
				return { ok: true as const, result };
			}
			case "table.deleteOpts": {
				const acc = db.table(input.table as never);
				const result = await acc.delete(input.opts as never);
				return { ok: true as const, result };
			}
			case "table.clear": {
				const acc = db.table(input.table as never);
				const cleared = await acc.clear();
				return { ok: true as const, cleared };
			}
			case "db.clearAll": {
				const cleared = await db.clearAll();
				return { ok: true as const, cleared };
			}
			case "catalog.get": {
				try {
					const jsonStr = readCurrentCatalogJsonString();
					return { ok: true as const, catalog: JSON.parse(jsonStr) };
				} catch (e) {
					const msg = e instanceof Error ? e.message : String(e);
					error("INTERNAL", `[admin/db] catalog.get: ${msg}`);
				}
			}
			case "catalog.push": {
				try {
					const { tableNames } = applyCatalogJsonString(input.catalogJson);
					return { ok: true as const, reloaded: true as const, tableNames };
				} catch (e) {
					const msg = e instanceof Error ? e.message : String(e);
					error("INTERNAL", `[admin/db] catalog.push: ${msg}`);
				}
			}
			case "checkpoint": {
				try {
					forceCheckpoint();
					return { ok: true as const, voidOk: true as const };
				} catch (e) {
					const msg = e instanceof Error ? e.message : String(e);
					error("INTERNAL", `[admin/db] checkpoint: ${msg}`);
				}
			}
		}
	},
	// L'endpoint admin può ricevere catalog.json grandi: aumentiamo leggermente il limite.
	sizeLimit: { in: 16 * 1024 * 1024 },
});
