import { db } from "db";
import { s, v } from "server";

const PREVIEW = 100;

type Tab = Exclude<keyof typeof db.tables, "$">;

/** Stesso payload di `desktop/routes/_devtools/db` — usa il DB del processo RPC (stesso di `auth.*`). */
export default s({
	run: async (_ctx) => {
		const { catalog, tableNames } = db.schema;
		const entries = await Promise.all(
			tableNames.map(async (name) => {
				const q = db.table(name as Tab);
				const [rowCount, sampleRows] = await Promise.all([
					q.count(),
					q.find(undefined, { limit: PREVIEW }),
				]);
				return [
					name,
					{
						...catalog.tables[name]!,
						rowCount,
						sampleRows: sampleRows as Record<string, unknown>[],
					},
				] as const;
			}),
		);
		return { tables: Object.fromEntries(entries) };
	},
});

export const rowUpdate = s({
	input: v.object({
		table: db,
		id: v.string(),
		field: v.string(),
		value: v.unknown(),
	}),
	run: async (inp, _ctx) => {
		await db.table(inp.table).update(
			{ id: inp.id } as never,
			{ [inp.field]: inp.value } as never,
		);
		return { ok: true as const };
	},
});

export const rowDelete = s({
	input: v.object({ table: db, id: v.string() }),
	run: async (inp, _ctx) => {
		await db.table(inp.table).delete({ id: inp.id } as never);
		return { ok: true as const };
	},
});
