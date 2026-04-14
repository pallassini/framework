import type { InputSchema } from "../client/validator/properties/defs";
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

export type ModuleExportRow<V> = V extends FwTable<infer R>
	? R
	: V extends TableBuilder<infer S>
		? FullRow<S>
		: V extends TableShape
			? FullRow<V>
			: never;
