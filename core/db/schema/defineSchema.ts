import { writeCatalogJsonToDisk } from "./write-catalog-json-to-disk";

export type IndexDef = {
	name: string;
	columns: [string, ...string[]];
	unique?: boolean;
};

export type FkDef = {
	columns: [string, ...string[]];
	references: { table: string; columns: [string, ...string[]] };
	onDelete?: "restrict" | "cascade" | "setNull";
};

export type TableSchemaInput = {
	pk?: string;
	indexes?: IndexDef[];
	foreignKeys?: FkDef[];
};

export type CatalogJson = {
	tables: Record<
		string,
		{
			pk: string;
			indexes: { name: string; columns: string[]; unique: boolean }[];
			foreignKeys: {
				columns: string[];
				references: { table: string; columns: string[] };
				onDelete: string;
			}[];
		}
	>;
};

/** Segna un blocco tabella nel DSL (stesso effetto di un letterale). */
export function tableSchema(spec: TableSchemaInput): TableSchemaInput {
	return spec;
}

/**
 * Schema stile Prisma-lite: un oggetto TS → `catalog.json` per Zig (PK, indici, FK).
 * Aggiunge automaticamente un indice non univoco sulla prima colonna di ogni FK se mancante
 * (il motore Zig usa quell’indice per RESTRICT/CASCADE).
 */
export function defineSchema<const T extends Record<string, TableSchemaInput>>(def: T) {
	const tables: CatalogJson["tables"] = {};
	for (const [tname, spec] of Object.entries(def)) {
		const pk = spec.pk ?? "id";
		const indexes: CatalogJson["tables"][string]["indexes"] = (spec.indexes ?? []).map((i) => ({
			name: i.name,
			columns: [...i.columns],
			unique: i.unique ?? false,
		}));
		const foreignKeys = spec.foreignKeys ?? [];
		for (const fk of foreignKeys) {
			const col = fk.columns[0];
			const has = indexes.some((i) => i.columns.length === 1 && i.columns[0] === col);
			if (!has) indexes.push({ name: col, columns: [col], unique: false });
		}
		tables[tname] = {
			pk,
			indexes,
			foreignKeys: foreignKeys.map((fk) => ({
				columns: [...fk.columns],
				references: { table: fk.references.table, columns: [...fk.references.columns] },
				onDelete: fk.onDelete ?? "restrict",
			})),
		};
	}
	const catalog: CatalogJson = { tables };
	return {
		catalog,
		tableNames: Object.keys(def) as (keyof T & string)[],
		pkByTable: Object.fromEntries(Object.entries(def).map(([k, v]) => [k, v.pk ?? "id"])) as Record<
			string,
			string
		>,
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
