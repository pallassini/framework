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
import { db, applyCatalogJsonString, readCurrentCatalogJsonString, forceCheckpoint, getLiveFwTables } from "db";
import { error, FlowError } from "../../../core/server/error";
import { ValidationError, type InputSchema } from "../../../core/client/validator/properties/defs";
import type { BatchableOp, RemoteErrorBody, TableOp, TableOpResult } from "../../../core/db/remote/protocol";
import { assertAdminAuth } from "../../../core/db/remote/server-auth";
import { getFwTableColumns } from "../../../core/db/schema/table";

const KNOWN_OPS = new Set([
	"table.find",
	"table.findOpts",
	"table.byId",
	"table.count",
	"table.countOpts",
	"table.create",
	"table.update",
	"table.updateOpts",
	"table.delete",
	"table.deleteOpts",
	"table.clear",
	"db.clearAll",
	"catalog.get",
	"catalog.push",
	"checkpoint",
]);

const opSchema: InputSchema<TableOp> = {
	parse(raw) {
		if (typeof raw !== "object" || raw === null) throw new ValidationError("expected object");
		const o = raw as Record<string, unknown>;
		const op = o.op;
		if (typeof op !== "string") throw new ValidationError("op required");
		if (op === "batch") {
			if (!Array.isArray(o.ops)) throw new ValidationError("batch.ops must be an array");
			for (const child of o.ops as unknown[]) {
				if (typeof child !== "object" || child === null) {
					throw new ValidationError("batch.ops[*] must be an object");
				}
				const cop = (child as { op?: unknown }).op;
				if (typeof cop !== "string") throw new ValidationError("batch.ops[*].op required");
				if (cop === "batch") throw new ValidationError("nested batch not allowed");
				if (!KNOWN_OPS.has(cop)) throw new ValidationError(`unknown op: ${cop}`);
			}
			return raw as TableOp;
		}
		if (KNOWN_OPS.has(op)) return raw as TableOp;
		throw new ValidationError(`unknown op: ${op}`);
	},
};

/** Esegue UNA `BatchableOp` ritornando un `TableOpResult` (o lancia FlowError). */
async function dispatchOp(input: BatchableOp): Promise<TableOpResult> {
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
					const catalog = JSON.parse(jsonStr) as {
						tables: Record<string, Record<string, unknown>>;
					};
					// Arricchiamo il catalog con i tipi delle colonne presi dal bundle live:
					// il catalog.json "puro" contiene solo pk/indexes/foreignKeys, servono anche
					// i tipi per poter rigenerare uno schema TS leggibile in `db/pulled.ts`.
					const fwByName = new Map(
						getLiveFwTables().map((t) => [t.name, t]),
					);
					const tableOrder: string[] = [];
					for (const [name, meta] of Object.entries(catalog.tables)) {
						tableOrder.push(name);
						const fw = fwByName.get(name);
						const cols = fw ? getFwTableColumns(fw) : undefined;
						if (cols) (meta as Record<string, unknown>).columns = cols;
					}
					return { ok: true as const, catalog, tableOrder };
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
	// Unreachable ma richiesto per tipizzazione.
	error("INTERNAL", "[admin/db] op non gestita");
}

/** Serializza un errore per un singolo slot del batch (non fa buttar giù l'intera richiesta). */
function errorToRemoteBody(e: unknown): RemoteErrorBody {
	if (e instanceof FlowError) {
		return {
			ok: false,
			error: {
				type: e.type as RemoteErrorBody["error"]["type"],
				message: e.message,
			},
		};
	}
	const msg = e instanceof Error ? e.message : String(e);
	return { ok: false, error: { type: "INTERNAL", message: msg } };
}

export const rpc = s({
	input: opSchema,
	// Auth fatto a mano: non è una sessione, è un secret condiviso tramite env.
	async run(input, ctx) {
		assertAdminAuth(ctx.headers);

		if (input.op === "batch") {
			// Eseguite IN ORDINE: le mutazioni non vanno parallelizzate (stesso
			// WAL). Le letture pure potrebbero, ma la semplicità batte la
			// micro-ottimizzazione — il WIN vero è il round-trip risparmiato.
			const results: (TableOpResult | RemoteErrorBody)[] = [];
			for (const sub of input.ops) {
				try {
					results.push(await dispatchOp(sub));
				} catch (e) {
					results.push(errorToRemoteBody(e));
				}
			}
			return { ok: true as const, results };
		}

		return dispatchOp(input);
	},
	// L'endpoint admin può ricevere catalog.json grandi: aumentiamo leggermente il limite.
	sizeLimit: { in: 16 * 1024 * 1024 },
});
