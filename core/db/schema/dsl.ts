import type { CatalogJson } from "./defineSchema";
import { writeCatalogJsonToDisk } from "./write-catalog-json-to-disk";

/** Campo stringa nel JSON riga (opzionale / univoco come indice Zig). */
export type StrField = { kind: "str"; unique: boolean; optional: boolean };

/** FK verso `altraTabella.id` (PK sempre `id`). */
export type FkField = { kind: "fk"; table: string; onDelete: "restrict" | "cascade" | "setNull" };

export type Field = StrField | FkField;

/** Builder campi (stile compatto, vicino a Prisma). */
export const t = {
	str(opts?: { unique?: boolean; optional?: boolean }): StrField {
		return {
			kind: "str",
			unique: opts?.unique ?? false,
			optional: opts?.optional ?? false,
		};
	},
	/** `t.fk("users")` → colonna corrente referenzia `users.id`. */
	fk(table: string, onDelete: "restrict" | "cascade" | "setNull" = "cascade"): FkField {
		return { kind: "fk", table, onDelete };
	},
};

/**
 * Schema da `db/index.ts`: oggetto `{ tabella: { colonna: campo } }` → `catalog.json` (Zig).
 */
export function defineDb<const T extends Record<string, Record<string, Field>>>(tables: T) {
	const tablesOut: CatalogJson["tables"] = {};
	for (const [tname, fields] of Object.entries(tables)) {
		const pk = "id";
		const indexes: CatalogJson["tables"][string]["indexes"] = [];
		const foreignKeys: CatalogJson["tables"][string]["foreignKeys"] = [];
		for (const [colName, f] of Object.entries(fields)) {
			if (f.kind === "str" && f.unique) {
				indexes.push({ name: colName, columns: [colName], unique: true });
			}
			if (f.kind === "fk") {
				foreignKeys.push({
					columns: [colName],
					references: { table: f.table, columns: ["id"] },
					onDelete: f.onDelete,
				});
				const hasIx = indexes.some((i) => i.columns[0] === colName && i.columns.length === 1);
				if (!hasIx) indexes.push({ name: colName, columns: [colName], unique: false });
			}
		}
		tablesOut[tname] = { pk, indexes, foreignKeys };
	}
	const catalog: CatalogJson = { tables: tablesOut };
	const tableNames = Object.keys(tables) as (keyof T & string)[];
	const pkByTable = Object.fromEntries(tableNames.map((n) => [n, "id"])) as Record<string, string>;

	return {
		catalog,
		tableNames,
		pkByTable,
		toJSON(): string {
			return JSON.stringify(catalog);
		},
		toJSONPretty(): string {
			return JSON.stringify(catalog, null, 2);
		},
		writeCatalogSync(dir: string) {
			writeCatalogJsonToDisk(dir, catalog);
		},
	};
}
