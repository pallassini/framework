/**
 * `schema(...)` — raggruppa tabelle e (ricorsivamente) altri schemi in un namespace.
 * Non tocca il catalog/runtime del DB: è solo una **etichettatura** per devtools/UI.
 *
 * API:
 * ```ts
 * export const auth = schema([users, sessions]);
 * export const billing = schema([invoices]);
 * export const app = schema([auth, billing]); // nesting infinito
 * ```
 *
 * Il `name` viene ricavato dalla chiave di export (`collectModuleSchemas`);
 * può anche essere passato esplicitamente: `schema("auth", [...])`.
 */

import type { InputSchema } from "../../client/validator/properties/defs";
import { isFwTable, isTableBuilder, type FwTable, type TableBuilder } from "./table";

export const FW_SCHEMA = Symbol.for("framework.db.schema");

export type FwSchemaChild =
	| FwTable<unknown>
	| FwSchema
	| TableBuilder<Record<string, InputSchema<unknown> | string>>;

export type FwSchema = {
	readonly [FW_SCHEMA]: true;
	/** Assegnato dall'export key dal walker se mancante. */
	name: string;
	readonly children: readonly FwSchemaChild[];
};

export function isFwSchema(x: unknown): x is FwSchema {
	return (
		typeof x === "object" &&
		x !== null &&
		(x as { [FW_SCHEMA]?: unknown })[FW_SCHEMA] === true
	);
}

export function schema(children: readonly FwSchemaChild[]): FwSchema;
export function schema(name: string, children: readonly FwSchemaChild[]): FwSchema;
export function schema(a: unknown, b?: unknown): FwSchema {
	const hasName = typeof a === "string";
	const name = hasName ? (a as string) : "";
	const children = (hasName ? b : a) as readonly FwSchemaChild[] | undefined;
	if (!Array.isArray(children)) {
		throw new Error(`[db] schema(): atteso un array di tabelle/schemi come children`);
	}
	for (const c of children) {
		if (!isFwTable(c) && !isFwSchema(c) && !isTableBuilder(c)) {
			throw new Error(
				`[db] schema("${name || "<anonymous>"}"): children deve contenere solo table(...) o schema(...)`,
			);
		}
	}
	return {
		[FW_SCHEMA]: true,
		name,
		children: [...children],
	};
}

/** Appiattisce ricorsivamente le `FwTable` raggiungibili (i `TableBuilder` non hanno nome → ignorati qui). */
export function flattenSchemaTables(s: FwSchema): FwTable<unknown>[] {
	const out: FwTable<unknown>[] = [];
	const seen = new Set<FwTable<unknown>>();
	const visit = (children: readonly FwSchemaChild[]): void => {
		for (const c of children) {
			if (isFwSchema(c)) visit(c.children);
			else if (isFwTable(c) && !seen.has(c)) {
				seen.add(c);
				out.push(c);
			}
		}
	};
	visit(s.children);
	return out;
}
