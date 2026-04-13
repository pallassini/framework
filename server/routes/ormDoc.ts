import { v } from "../../core/client/validator";
import type { OrmDocOutput } from "../../core/client/db/orm/rpcTypes";
import type { ServerContext } from "../../core/server/routes/context";
import { error } from "../../core/server/error";
import {
	asPlainRow,
	assertOrmRelPath,
	parseWhereClause,
	serverTablePath,
} from "../../core/server/orm/docValidate";

const PK_RE = /^[a-zA-Z_][a-zA-Z0-9_]{0,63}$/;

function assertPkField(pk: string): string {
	if (!PK_RE.test(pk)) error("INPUT", "[ormDoc] pkField non valido");
	return pk;
}
import { ormDocStore } from "../../core/server/orm/docStore";
import { s } from "server";

/**
 * Tutte le operazioni ORM documentali passano da qui: validazione path, righe piatte, where strutturato.
 * Path effettivo: `/app/` + `relPath` (il client non può uscire da questo prefisso).
 */
export default s({
	input: v.object({
		op: v.string(),
		relPath: v.string(),
		pkField: v.optional(v.string()),
		row: v.optional(v.unknown()),
		where: v.optional(v.unknown()),
		patch: v.optional(v.unknown()),
		limit: v.optional(v.integer()),
		offset: v.optional(v.integer()),
	}),
	sizeLimit: { in: 64 * 1024 },
	run: async (
		inp: {
			op: string;
			relPath: string;
			pkField?: string;
			row?: unknown;
			where?: unknown;
			patch?: unknown;
			limit?: number;
			offset?: number;
		},
		_ctx: ServerContext,
	): Promise<OrmDocOutput> => {
		assertOrmRelPath(inp.relPath);
		const tablePath = serverTablePath(inp.relPath);
		const pkField = assertPkField((inp.pkField ?? "id").trim());

		switch (inp.op) {
			case "insert": {
				if (inp.row === undefined) error("INPUT", "[ormDoc] insert richiede row");
				const row = asPlainRow(inp.row);
				const r = await ormDocStore.insert(tablePath, pkField, row);
				return { op: "insert", row: r };
			}
			case "update": {
				if (inp.patch === undefined) error("INPUT", "[ormDoc] update richiede patch");
				const clause = parseWhereClause(inp.where ?? { and: [] });
				const patch = asPlainRow(inp.patch);
				const n = await ormDocStore.update(tablePath, pkField, clause, patch);
				return { op: "update", affected: n };
			}
			case "delete": {
				const clause = parseWhereClause(inp.where ?? { and: [] });
				const n = await ormDocStore.delete(tablePath, pkField, clause);
				return { op: "delete", affected: n };
			}
			case "findMany": {
				const where = parseWhereClause(inp.where);
				const limit = Math.min(500, Math.max(1, inp.limit ?? 100));
				const offset = Math.min(10_000, Math.max(0, inp.offset ?? 0));
				const rows = await ormDocStore.findMany(tablePath, { where, limit, offset });
				return { op: "findMany", rows };
			}
			default:
				error("INPUT", `[ormDoc] op sconosciuta: ${inp.op}`);
		}
	},
});
