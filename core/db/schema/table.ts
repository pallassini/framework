import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { v } from "../../client/validator";
import {
	FIELD_OPTIONAL,
	FIELD_UNIQUE,
	isSchemaWithInputDefault,
	type SchemaWithInputDefault,
	readFieldType,
	type FieldTypeDesc,
} from "../../client/validator/field-meta";
import { fk, REF, type RefMeta } from "../../client/validator/fk";
import type { InputSchema } from "../../client/validator/properties/defs";
import type { CatalogJson } from "./defineSchema";

/** Brand per riconoscere gli export tabella in `db push`. */
export const FW_TABLE = Symbol.for("framework.db.table");

/** Chiavi colonna dallo shape (`table({ ... })`) — usato da devtools quando non ci sono righe. */
export const FW_TABLE_COLUMN_KEYS = Symbol.for("framework.db.columnKeys");

/** Colonne dallo shape con metadati (`optional`, …) — usato da devtools per i badge. */
export const FW_TABLE_COLUMNS = Symbol.for("framework.db.columns");

/** Shape completo (colName → InputSchema) — esposto come `db.<t>.fields.<col>`. */
export const FW_TABLE_SHAPE = Symbol.for("framework.db.shape");

export type FwColumnMeta = {
	readonly key: string;
	readonly optional: boolean;
	readonly type: FieldTypeDesc;
};

export { REF, type RefMeta };

type InferTableVal<V> = V extends InputSchema<infer U> ? U : V extends string ? string : never;

/**
 * Chiave omissibile: `.optional()` (`U` include `undefined`) oppure `.default()` (stesso effetto
 * sull’input, valore “pieno” prodotto dal `parse` — vedi `SchemaWithInputDefault` / `FIELD_DEFAULT`).
 */
type OmissibleKey<S> = S extends SchemaWithInputDefault
	? true
	: S extends InputSchema<infer U>
		? undefined extends U
			? true
			: false
		: false;

type InferTableRow<S extends Record<string, InputSchema<unknown> | string>> = {
	[K in keyof S as OmissibleKey<S[K]> extends true ? K : never]?: InferTableVal<S[K]>;
} & {
	[K in keyof S as OmissibleKey<S[K]> extends true ? never : K]: InferTableVal<S[K]>;
};

/**
 * Riga con `id` sempre presente e timestamps sempre disponibili come opzionali
 * (iniettati a runtime se non dichiarati). Esposti qui così `pick`/`omit` li accettano.
 */
export type FullRow<S extends Record<string, InputSchema<unknown> | string>> = {
	id: string;
	createdAt?: Date;
	updatedAt?: Date;
	deletedAt?: Date;
} & InferTableRow<S>;

function isFieldSchema(x: unknown): x is InputSchema<unknown> {
	return (
		typeof x === "object" &&
		x !== null &&
		"parse" in x &&
		typeof (x as InputSchema<unknown>).parse === "function"
	);
}

/** Oggetto `{ col: v.string() | "users" | ref(...) }` vs un solo `InputSchema` (es. `v.object({...})`). */
function isTableShape(row: unknown): row is Record<string, InputSchema<unknown> | string> {
	if (typeof row !== "object" || row === null) return false;
	const o = row as Record<string, unknown>;
	const keys = Object.keys(o);
	if (keys.length === 0) return false;
	if (keys.length === 1 && keys[0] === "parse") return false;
	return keys.every((k) => typeof o[k] === "string" || isFieldSchema(o[k]));
}

function normalizeShapeFields(raw: Record<string, unknown>): Record<string, InputSchema<unknown>> {
	const out: Record<string, InputSchema<unknown>> = {};
	for (const [k, val] of Object.entries(raw)) {
		if (typeof val === "string") {
			out[k] = fk(val);
		} else if (isFieldSchema(val)) {
			out[k] = val;
		} else {
			throw new Error(`[db] campo "${k}": atteso v.*, ref/fk, o stringa nome tabella (FK → id)`);
		}
	}
	return out;
}

function injectId(shape: Record<string, InputSchema<unknown>>): Record<string, InputSchema<unknown>> {
	if ("id" in shape) return shape;
	return { id: v.string(), ...shape };
}

/** Aggiunto a ogni tabella se non dichiarato (timestamps opzionali + soft delete). */
function injectTimestamps(shape: Record<string, InputSchema<unknown>>): Record<string, InputSchema<unknown>> {
	const out = { ...shape };
	if (!("createdAt" in out)) out.createdAt = v.datetime().optional();
	if (!("updatedAt" in out)) out.updatedAt = v.datetime().optional();
	if (!("deletedAt" in out)) out.deletedAt = v.datetime().optional();
	return out;
}

function fkFromShape(shape: Record<string, InputSchema<unknown>>): TableMeta["fk"] | undefined {
	const fk: NonNullable<TableMeta["fk"]> = {};
	for (const [col, sch] of Object.entries(shape)) {
		if (typeof sch !== "object" || sch === null || !(REF in sch)) continue;
		const m = Reflect.get(sch, REF) as RefMeta;
		fk[col] = { ref: m.table, onDelete: m.onDelete };
	}
	return Object.keys(fk).length ? fk : undefined;
}

function uniqueFromShape(shape: Record<string, InputSchema<unknown>>): string[] {
	const cols: string[] = [];
	for (const [col, sch] of Object.entries(shape)) {
		if (typeof sch === "object" && sch !== null && FIELD_UNIQUE in sch && Reflect.get(sch, FIELD_UNIQUE) === true) {
			cols.push(col);
		}
	}
	return cols;
}

function mergeTableMeta(
	shape: Record<string, InputSchema<unknown>>,
	shapeFk: TableMeta["fk"] | undefined,
	user: TableMeta,
): TableMeta {
	const fk = { ...(user.fk ?? {}), ...(shapeFk ?? {}) };
	const fromFields = uniqueFromShape(shape);
	const uniq = [...new Set([...(user.unique ?? []), ...fromFields])];
	return {
		...user,
		fk: Object.keys(fk).length ? fk : undefined,
		unique: uniq.length ? uniq : undefined,
	};
}

/**
 * FK verso la PK (`id`) di un’altra tabella: a runtime è `v.string()`, nel catalog Zig diventa FK.
 * Con oggetti già creati: `ref(users)` o `users.ref({ onDelete: "cascade" })`.
 */
export function ref(
	table: FwTable<unknown>,
	opts?: { onDelete?: "restrict" | "cascade" },
): InputSchema<string> {
	return fk(table.name, opts);
}

/** FK per nome tabella (uso tipico dentro `bundle({ ... })` dove non hai ancora la const). */
export { fk };

export const TABLE_BUILDER = Symbol.for("framework.db.tableBuilder");

export type TableBuilder<S extends Record<string, InputSchema<unknown> | string>> = {
	readonly [TABLE_BUILDER]: true;
	readonly shape: S;
	readonly meta: TableMeta;
};

export function isTableBuilder(x: unknown): x is TableBuilder<Record<string, InputSchema<unknown> | string>> {
	return (
		typeof x === "object" &&
		x !== null &&
		(x as TableBuilder<Record<string, InputSchema<unknown> | string>>)[TABLE_BUILDER] === true
	);
}

export type FwTable<R = unknown> = {
	readonly [FW_TABLE]: true;
	readonly name: string;
	readonly row: InputSchema<R>;
	parse(raw: unknown): R;
	/** `ref(this)` — valore = id di questa tabella (per `authorId: users.id` quando `users` è già un `FwTable`). */
	readonly id: InputSchema<string>;
	/** `ref(this, opts)` se serve `onDelete` sul lato figlio. */
	readonly ref: (opts?: { onDelete?: "restrict" | "cascade" }) => InputSchema<string>;
};

/** Chiavi colonna dallo shape, se la tabella è definita con `table("name", { ... })`. */
export function getFwTableColumnKeys(t: FwTable<unknown>): string[] | undefined {
	const k = Reflect.get(t as object, FW_TABLE_COLUMN_KEYS) as readonly string[] | undefined;
	return k ? [...k] : undefined;
}

/** Colonne complete dallo shape con metadati (`optional`, `type`), se disponibile. */
export function getFwTableColumns(t: FwTable<unknown>): FwColumnMeta[] | undefined {
	const c = Reflect.get(t as object, FW_TABLE_COLUMNS) as readonly FwColumnMeta[] | undefined;
	return c ? c.map((x) => ({ key: x.key, optional: x.optional, type: x.type })) : undefined;
}

/** Shape completo (colName → InputSchema) — per `db.<t>.fields` / `pick` / `omit`. */
export function getFwTableShape(t: FwTable<unknown>): Record<string, InputSchema<unknown>> | undefined {
	const s = Reflect.get(t as object, FW_TABLE_SHAPE) as Record<string, InputSchema<unknown>> | undefined;
	return s;
}

function isOptionalSchema(s: unknown): boolean {
	return typeof s === "object" && s !== null && FIELD_OPTIONAL in s;
}

function typeOfSchema(s: InputSchema<unknown>): FieldTypeDesc {
	return readFieldType(s) ?? { kind: "unknown" };
}

function columnsFromShape(shape: Record<string, InputSchema<unknown>>): FwColumnMeta[] {
	return Object.keys(shape).map((key) => ({
		key,
		optional: isOptionalSchema(shape[key]) || isSchemaWithInputDefault(shape[key]),
		type: typeOfSchema(shape[key]),
	}));
}

type AppDbExports = typeof import("../../../db/index");
type AppDbTableKey<K> = K extends string ? (K extends "default" | `_${string}` ? never : K) : never;

/**
 * Nomi export in `db/index.ts` usabili come stringhe FK in `table({ ... })`.
 * Solo `keyof` del modulo (senza filtrare per “è una tabella”) per evitare cicli con `works = table(...)`.
 */
export type AppDbTableName = AppDbTableKey<keyof AppDbExports>;

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
		const ond = spec.onDelete ?? "cascade";
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
 * Definizione tabella.
 * - `bundle({ users: table({ ... }, { unique }), ... })` — il **nome** è la chiave (`users`).
 * - `table("users", { ... }, meta)` oppure `table("users", v.object(...), meta)` — nome esplicito.
 * - In uno shape a campi: `"altraTabella"` → FK verso `altraTabella.id` (default `onDelete: cascade`); `id` è opzionale (altrimenti iniettato).
 * - Le stringhe FK nello shape sono `AppDbTableName` (export tabella in `db/index.ts`), senza generic sull’app.
 */
export function table<
	const S extends {
		readonly [K in keyof S]: S[K] extends InputSchema<unknown> ? InputSchema<unknown> : AppDbTableName;
	},
>(shape: S, meta?: TableMeta): TableBuilder<S>;
export function table<const R, const Name extends string>(
	name: Name,
	row: InputSchema<R>,
	meta?: TableMeta,
): FwTable<R>;
export function table<
	const Name extends string,
	const S extends {
		readonly [K in keyof S]: S[K] extends InputSchema<unknown> ? InputSchema<unknown> : AppDbTableName;
	},
>(name: Name, shape: S, meta?: TableMeta): FwTable<FullRow<S>>;
/** Uso interno (`collect`, shape già `Record<…>` senza chiavi letterali). */
export function table<
	const Name extends string,
	const S extends Record<string, InputSchema<unknown> | string>,
>(name: Name, shape: S, meta?: TableMeta): FwTable<FullRow<S>>;
export function table(
	a: unknown,
	b?: unknown,
	c?: unknown,
): FwTable<unknown> | TableBuilder<Record<string, InputSchema<unknown> | string>> {
	if (typeof a === "string") {
		const name = a;
		const rowOrShape = b;
		const meta = (c ?? {}) as TableMeta;
		if (isTableShape(rowOrShape)) {
			const normalized = normalizeShapeFields(rowOrShape as Record<string, unknown>);
			const withId = injectId(normalized);
			const withTs = injectTimestamps(withId);
			const merged = mergeTableMeta(withTs, fkFromShape(withTs), meta);
			return defineTableCore(
				name,
				v.object(withTs),
				merged,
				Object.keys(withTs),
				columnsFromShape(withTs),
				withTs,
			);
		}
		return defineTableCore(name, rowOrShape as InputSchema<unknown>, meta);
	}
	const shape = a as Record<string, InputSchema<unknown> | string>;
	const meta = (b ?? {}) as TableMeta;
	return {
		[TABLE_BUILDER]: true,
		shape,
		meta,
	} as TableBuilder<typeof shape>;
}

/** @deprecated Usa `table`. */
export const defineTable = table;

function attachFkHelpers<R>(def: FwTable<R>): FwTable<R> {
	const self = def as unknown as FwTable<unknown>;
	Object.defineProperty(def, "id", {
		value: ref(self),
		enumerable: true,
		configurable: true,
	});
	Object.defineProperty(def, "ref", {
		value: (opts?: { onDelete?: "restrict" | "cascade" }) => ref(self, opts),
		enumerable: true,
		configurable: true,
	});
	return def;
}

function defineTableCore<const R, const Name extends string>(
	name: Name,
	row: InputSchema<R>,
	meta: TableMeta,
	columnKeys?: readonly string[],
	columns?: readonly FwColumnMeta[],
	shape?: Record<string, InputSchema<unknown>>,
): FwTable<R> {
	const catalogRow = catalogRowForTable(name, meta);
	const def = {
		[FW_TABLE]: true,
		name,
		row,
		parse(raw: unknown): R {
			return row.parse(raw);
		},
	} as unknown as FwTable<R>;
	Object.defineProperty(def, "_catalogRow", { value: catalogRow, enumerable: false });
	if (columnKeys?.length) {
		Object.defineProperty(def, FW_TABLE_COLUMN_KEYS, {
			value: Object.freeze([...columnKeys]),
			enumerable: false,
			configurable: false,
		});
	}
	if (columns?.length) {
		Object.defineProperty(def, FW_TABLE_COLUMNS, {
			value: Object.freeze(columns.map((c) => Object.freeze({ ...c }))),
			enumerable: false,
			configurable: false,
		});
	}
	if (shape) {
		Object.defineProperty(def, FW_TABLE_SHAPE, {
			value: Object.freeze({ ...shape }),
			enumerable: false,
			configurable: false,
		});
	}
	return attachFkHelpers(def);
}

export type Bundled<T extends Record<string, unknown> = Record<string, unknown>> = ReturnType<
	typeof bundleTables
> & {
	readonly tables: {
		-readonly [K in keyof T]: T[K] extends TableBuilder<infer S>
			? FwTable<FullRow<S>>
			: T[K] extends FwTable<infer R>
				? FwTable<R>
				: FwTable<unknown>;
	};
};

/**
 * Schema da un oggetto `{ nomeTabella: table({ campi }, meta) }`: il nome è la **chiave**.
 */
export function bundle<const T extends Record<string, unknown>>(defs: T): Bundled<T> {
	const fw: FwTable<unknown>[] = [];
	const tables = {} as { [K in keyof T]: FwTable<unknown> };
	for (const name of Object.keys(defs).sort() as (keyof T & string)[]) {
		const val = defs[name];
		let t: FwTable<unknown>;
		if (isTableBuilder(val)) {
			const raw = val.shape as Record<string, unknown>;
			const normalized = normalizeShapeFields(raw);
			const withId = injectId(normalized);
			const withTs = injectTimestamps(withId);
			const merged = mergeTableMeta(withTs, fkFromShape(withTs), val.meta);
			t = defineTableCore(
				name,
				v.object(withTs),
				merged,
				Object.keys(withTs),
				columnsFromShape(withTs),
				withTs,
			);
		} else if (isFwTable(val)) {
			if (val.name !== name) {
				throw new Error(`[db] bundle: chiave "${name}" ≠ tabella.name "${val.name}"`);
			}
			t = val;
		} else {
			throw new Error(`[db] bundle("${String(name)}"): atteso table({ ... }, meta?) o FwTable`);
		}
		fw.push(t);
		tables[name] = t;
	}
	const base = bundleTables(fw);
	return Object.assign(base, { tables }) as Bundled<T>;
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
	/** FwTable istanziate (con simboli `FW_TABLE_COLUMNS` ecc.) — usate dai devtools. */
	fwTables: readonly FwTable<unknown>[];
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
		fwTables: [...tables],
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

/** Tipo del valore restituito da `bundleTables` (schema app lato server). */
export type DbBundleSchema = ReturnType<typeof bundleTables>;
