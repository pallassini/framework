import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { InputSchema } from "../../client/validator/properties/defs";
import type { CatalogJson } from "./defineSchema";

/** Brand per riconoscere gli export tabella in `db push`. */
export const FW_TABLE = Symbol.for("framework.db.table");

export type FwTable<R = unknown> = {
	readonly [FW_TABLE]: true;
	readonly name: string;
	readonly row: InputSchema<R>;
	parse(raw: unknown): R;
};

export type TableMeta = {
	/** Colonne con indice univoco Zig (es. `email`). */
	unique?: readonly string[];
	/** FK: colonna → tabella referenziata (sempre `.id`). */
	fk?: Record<string, { ref: string; onDelete?: "restrict" | "cascade" }>;
};

function catalogRowForTable(name: string, meta: TableMeta): CatalogJson["tables"][string] {
	const pk = "id";
	const indexes: CatalogJson["tables"][string]["indexes"] = [];
	const foreignKeys: CatalogJson["tables"][string]["foreignKeys"] = [];
	for (const col of meta.unique ?? []) {
		indexes.push({ name: col, columns: [col], unique: true });
	}
	for (const [col, spec] of Object.entries(meta.fk ?? {})) {
		const ond = spec.onDelete ?? "restrict";
		foreignKeys.push({
			columns: [col],
			references: { table: spec.ref, columns: ["id"] },
			onDelete: ond,
		});
		const hasIx = indexes.some((i) => i.columns[0] === col && i.columns.length === 1);
		if (!hasIx) indexes.push({ name: col, columns: [col], unique: false });
	}
	return { pk, indexes, foreignKeys };
}

/**
 * Una tabella: nome + schema riga `v.object` + meta indici/FK per il catalog Zig.
 * Esporta come `export const users = defineTable("users", v.object({...}), { unique: ["email"] })`.
 */
export function defineTable<const R, const Name extends string>(
	name: Name,
	row: InputSchema<R>,
	meta: TableMeta = {},
): FwTable<R> {
	const catalogRow = catalogRowForTable(name, meta);
	const def: FwTable<R> = {
		[FW_TABLE]: true,
		name,
		row,
		parse(raw: unknown): R {
			return row.parse(raw);
		},
	};
	Object.defineProperty(def, "_catalogRow", { value: catalogRow, enumerable: false });
	return def;
}

/** @internal */
export function getCatalogRow(t: FwTable<unknown>): CatalogJson["tables"][string] {
	return (t as unknown as { _catalogRow: CatalogJson["tables"][string] })._catalogRow;
}

export function isFwTable(x: unknown): x is FwTable<unknown> {
	return typeof x === "object" && x !== null && (x as FwTable<unknown>)[FW_TABLE] === true;
}

/** Unisce le tabelle in un catalog unico (default export da `db/index.ts`). */
export function bundleTables(tables: readonly FwTable<unknown>[]): {
	catalog: CatalogJson;
	tableNames: string[];
	pkByTable: Record<string, string>;
	toJSON(): string;
	toJSONPretty(): string;
	writeCatalogSync(dir: string): void;
} {
	const names = new Set<string>();
	for (const t of tables) {
		if (names.has(t.name)) throw new Error(`[db] tabella duplicata: "${t.name}"`);
		names.add(t.name);
	}
	const fkRefs = new Set<string>();
	for (const t of tables) {
		const row = getCatalogRow(t);
		for (const fk of row.foreignKeys) fkRefs.add(fk.references.table);
	}
	for (const ref of fkRefs) {
		if (!names.has(ref)) throw new Error(`[db] FK verso tabella sconosciuta: "${ref}"`);
	}

	const tablesOut: CatalogJson["tables"] = {};
	for (const t of [...tables].sort((a, b) => a.name.localeCompare(b.name))) {
		tablesOut[t.name] = getCatalogRow(t);
	}
	const catalog: CatalogJson = { tables: tablesOut };
	const tableNames = Object.keys(tablesOut).sort();
	const pkByTable = Object.fromEntries(tableNames.map((n) => [n, "id"]));

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
			mkdirSync(dir, { recursive: true });
			writeFileSync(join(dir, "catalog.json"), `${JSON.stringify(catalog)}\n`);
		},
	};
}
