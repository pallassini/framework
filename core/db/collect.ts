import type { InputSchema } from "../client/validator/properties/defs";
import { isFwSchema, type FwSchema, type FwSchemaChild } from "./schema/namespace";
import {
	isFwTable,
	isTableBuilder,
	table as defineTable,
	type FwTable,
	type FullRow,
	type TableBuilder,
} from "./schema/table";

export type TableShape = Record<string, InputSchema<unknown> | string>;

function isInputSchema(x: unknown): x is InputSchema<unknown> {
	return (
		typeof x === "object" &&
		x !== null &&
		"parse" in x &&
		typeof (x as InputSchema<unknown>).parse === "function"
	);
}

export function isTableShape(row: unknown): row is TableShape {
	if (typeof row !== "object" || row === null) return false;
	const o = row as Record<string, unknown>;
	const keys = Object.keys(o);
	if (keys.length === 0) return false;
	if (keys.length === 1 && keys[0] === "parse") return false;
	return keys.every((k) => typeof o[k] === "string" || isInputSchema(o[k]));
}

export function collectModuleTables(mod: Record<string, unknown>): FwTable<unknown>[] {
	const tables: FwTable<unknown>[] = [];
	for (const name of Object.keys(mod).sort()) {
		if (name === "default" || name.startsWith("_")) continue;
		const val = mod[name];
		if (isFwTable(val)) {
			tables.push(val);
			continue;
		}
		if (isTableBuilder(val)) {
			tables.push(defineTable(name, val.shape, val.meta));
			continue;
		}
		if (isTableShape(val)) {
			tables.push(defineTable(name, val));
		}
	}
	return tables;
}

/**
 * Ordine di dichiarazione dei table export in `db/index.ts` (senza alfabetizzare).
 * Usato dai devtools per mostrare tabelle e colonne nello stesso ordine del file sorgente.
 */
export function collectModuleTableOrder(mod: Record<string, unknown>): string[] {
	const out: string[] = [];
	const seen = new Set<string>();
	for (const key of Object.keys(mod)) {
		if (key === "default" || key.startsWith("_")) continue;
		const val = mod[key];
		let name: string | undefined;
		if (isFwTable(val)) name = val.name;
		else if (isTableBuilder(val) || isTableShape(val)) name = key;
		if (name && !seen.has(name)) {
			out.push(name);
			seen.add(name);
		}
	}
	return out;
}

export type ModuleExportRow<V> = V extends FwTable<infer R>
	? R
	: V extends TableBuilder<infer S>
		? FullRow<S>
		: V extends TableShape
			? FullRow<V>
			: never;

/**
 * Nodo serializzabile (per devtools/RPC) dell'albero degli schemi.
 * `path` = percorso dall'albero radice (es. `["app", "auth"]`); `tables` = tabelle dirette.
 */
export type SchemaNode = {
	readonly name: string;
	readonly path: readonly string[];
	readonly tables: readonly string[];
	readonly children: readonly SchemaNode[];
};

/**
 * Scorre gli export di `db/index.ts` e raccoglie tutti gli `FwSchema`.
 * Assegna `name` = export key quando mancante, riconosce i root (non referenziati come child).
 */
export function collectModuleSchemas(mod: Record<string, unknown>): {
	readonly allSchemas: readonly FwSchema[];
	readonly rootSchemas: readonly FwSchema[];
	readonly tree: readonly SchemaNode[];
} {
	// Reverse map: child reference → export name (serve per risolvere `TableBuilder`
	// che non hanno un `.name` proprio — `users = table({ ... })`).
	const nameByRef = new Map<object, string>();
	const allSchemas: FwSchema[] = [];
	for (const key of Object.keys(mod)) {
		if (key === "default" || key.startsWith("_")) continue;
		const val = mod[key];
		if (typeof val === "object" && val !== null) {
			nameByRef.set(val, key);
		}
		if (isFwSchema(val)) {
			if (!val.name) (val as { name: string }).name = key;
			allSchemas.push(val);
		}
	}

	const referenced = new Set<FwSchema>();
	for (const s of allSchemas) {
		for (const c of s.children) {
			if (isFwSchema(c)) referenced.add(c);
		}
	}
	const rootSchemas = allSchemas.filter((s) => !referenced.has(s));

	const toNode = (s: FwSchema, parentPath: readonly string[]): SchemaNode => {
		const path = [...parentPath, s.name || "<anonymous>"];
		const tables: string[] = [];
		const children: SchemaNode[] = [];
		for (const c of s.children as readonly FwSchemaChild[]) {
			if (isFwSchema(c)) {
				children.push(toNode(c, path));
			} else if (isFwTable(c)) {
				tables.push(c.name);
			} else if (isTableBuilder(c)) {
				const resolved = nameByRef.get(c as object);
				if (resolved) tables.push(resolved);
			}
		}
		return { name: s.name || "<anonymous>", path, tables, children };
	};

	const tree = rootSchemas.map((s) => toNode(s, []));
	return { allSchemas, rootSchemas, tree };
}
