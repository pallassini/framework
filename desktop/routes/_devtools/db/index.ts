import { getLiveFwTables } from "../../../../core/db/index";
import {
	getFwTableColumnKeys,
	getFwTableColumns,
	type FwColumnMeta,
} from "../../../../core/db/schema/table";
import { sortDbColumnKeys } from "../../../../core/db/schema/sortColumnKeys";
import { d, v } from "desktop";
import { db } from "db";

const PREVIEW = 100;

type Tab = Exclude<keyof typeof db.tables, "$">;

type ColumnInfo = { key: string; optional: boolean };

function columnKeysFromRows(rows: readonly Record<string, unknown>[]): string[] {
	const keys = new Set<string>();
	for (const r of rows) for (const k of Object.keys(r)) keys.add(k);
	return sortDbColumnKeys([...keys]);
}

function mergeFieldKeys(
	schemaKeys: string[] | undefined,
	sampleRows: Record<string, unknown>[],
): string[] {
	const set = new Set<string>(schemaKeys ?? []);
	for (const k of columnKeysFromRows(sampleRows)) set.add(k);
	return sortDbColumnKeys([...set]);
}

function buildColumns(
	schemaCols: FwColumnMeta[] | undefined,
	schemaKeys: string[] | undefined,
	sampleRows: Record<string, unknown>[],
): ColumnInfo[] {
	const byKey = new Map<string, ColumnInfo>();
	for (const c of schemaCols ?? []) {
		byKey.set(c.key, { key: c.key, optional: c.optional });
	}
	for (const k of schemaKeys ?? []) {
		if (!byKey.has(k)) byKey.set(k, { key: k, optional: false });
	}
	for (const k of columnKeysFromRows(sampleRows)) {
		if (!byKey.has(k)) byKey.set(k, { key: k, optional: false });
	}
	const ordered = sortDbColumnKeys([...byKey.keys()]);
	return ordered.map((k) => byKey.get(k)!);
}

export default d({
	run: async () => {
		const { catalog, tableNames } = db.schema;
		const fwByName = new Map(getLiveFwTables().map((t) => [t.name, t]));
		const entries = await Promise.all(
			tableNames.map(async (name) => {
				const q = db.table(name as Tab);
				const [rowCount, sampleRows] = await Promise.all([
					q.count(),
					q.find(undefined, { limit: PREVIEW }),
				]);
				const rows = sampleRows as Record<string, unknown>[];
				const fw = fwByName.get(name);
				const schemaKeys = fw ? getFwTableColumnKeys(fw) : undefined;
				const schemaCols = fw ? getFwTableColumns(fw) : undefined;
				const fieldKeys = mergeFieldKeys(schemaKeys, rows);
				const columns = buildColumns(schemaCols, schemaKeys, rows);
				return [
					name,
					{
						...catalog.tables[name]!,
						rowCount,
						sampleRows: rows,
						fieldKeys,
						columns,
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
