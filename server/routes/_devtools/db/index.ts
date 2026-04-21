import {
	getLiveDbSchemaTree,
	getLiveDbTableOrder,
	getLiveFwTables,
} from "../../../../core/db/index";
import type { FieldTypeDesc } from "../../../../core/client/validator/field-meta";
import {
	getFwTableColumnKeys,
	getFwTableColumns,
	type FwColumnMeta,
} from "../../../../core/db/schema/table";
import { orderColumnsBySchema } from "../../../../core/db/schema/sortColumnKeys";
import { buildDefaultRowFromColumns } from "../../../../core/db/devtools-default-row";
import { db } from "db";
import { s, v } from "server";

const PREVIEW = 100;

type Tab = Exclude<keyof typeof db.tables, "$">;

type ColumnInfo = { key: string; optional: boolean; type: FieldTypeDesc };

function columnKeysFromRows(rows: readonly Record<string, unknown>[]): string[] {
	const keys = new Set<string>();
	for (const r of rows) for (const k of Object.keys(r)) keys.add(k);
	return [...keys];
}

function mergeFieldKeys(
	schemaKeys: string[] | undefined,
	sampleRows: Record<string, unknown>[],
): string[] {
	const set = new Set<string>(schemaKeys ?? []);
	for (const k of columnKeysFromRows(sampleRows)) set.add(k);
	return orderColumnsBySchema(schemaKeys, [...set]);
}

function buildColumns(
	schemaCols: FwColumnMeta[] | undefined,
	schemaKeys: string[] | undefined,
	sampleRows: Record<string, unknown>[],
): ColumnInfo[] {
	const byKey = new Map<string, ColumnInfo>();
	for (const c of schemaCols ?? []) {
		byKey.set(c.key, { key: c.key, optional: c.optional, type: c.type });
	}
	const unknownType: FieldTypeDesc = { kind: "unknown" };
	for (const k of schemaKeys ?? []) {
		if (!byKey.has(k)) byKey.set(k, { key: k, optional: false, type: unknownType });
	}
	for (const k of columnKeysFromRows(sampleRows)) {
		if (!byKey.has(k)) byKey.set(k, { key: k, optional: false, type: unknownType });
	}
	const schemaOrder = schemaCols?.map((c) => c.key);
	const ordered = orderColumnsBySchema(schemaOrder, [...byKey.keys()]);
	return ordered.map((k) => byKey.get(k)!);
}

/** Stesso payload di `desktop/routes/_devtools/db` — usa il DB del processo RPC (stesso di `auth.*`). */
export default s({
	run: async (_ctx) => {
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
		return {
			tables: Object.fromEntries(entries),
			schemaTree: getLiveDbSchemaTree(),
			tableOrder: getLiveDbTableOrder(),
		};
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

export const rowCreate = s({
	input: v.object({ table: db }),
	run: async (inp, _ctx) => {
		const fw = getLiveFwTables().find((t) => t.name === inp.table);
		const cols = fw ? getFwTableColumns(fw) : undefined;
		const row = buildDefaultRowFromColumns(cols);
		const created = await db.table(inp.table).create(row as never);
		return { ok: true as const, row: created[0] };
	},
});
