import { d, v } from "desktop";
import { db } from "db";

const PREVIEW = 100;

type Tab = Exclude<keyof typeof db.tables, "$">;

export default d({
	run: async () => {
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

export const rowUpdate = d({
	input: v.object({
		table: db,
		id: v.string(),
		field: v.string(),
		value: v.unknown(),
	}),
	run: async (inp) => {
		await db.table(inp.table).update(
			{ id: inp.id } as never,
			{ [inp.field]: inp.value } as never,
		);
		return { ok: true as const };
	},
});

export const rowDelete = d({
	input: v.object({ table: db, id: v.string() }),
	run: async (inp) => {
		await db.table(inp.table).delete({ id: inp.id } as never);
		return { ok: true as const };
	},
});
