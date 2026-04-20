import { REF } from "./db-ref";
import type { InputSchema } from "./properties/defs";
import { optional } from "./properties/optional";
import { string } from "./properties/string";

export { REF };

export type RefMeta = { table: string; onDelete: "restrict" | "cascade" };

export type FkSchema = InputSchema<string> & {
	optional(): InputSchema<string | undefined>;
};

/**
 * FK verso la PK (`id`) di un’altra tabella: a runtime è `v.string()`, con metadati `REF`
 * per tooling e catalog (solo colonne top-level nello shape della tabella).
 * Usabile anche dentro `v.object` / `v.array` (es. snapshot) dove le stringhe `"tabella"` non valgono.
 */
export function fk(tableName: string, opts?: { onDelete?: "restrict" | "cascade" }): FkSchema {
	const inner = string();
	const onDelete = opts?.onDelete ?? "cascade";
	const base = {
		parse(raw: unknown) {
			return inner.parse(raw);
		},
		[REF]: { table: tableName, onDelete } satisfies RefMeta,
	};
	return Object.assign(base, {
		optional() {
			return optional(base as InputSchema<string>);
		},
	}) as FkSchema;
}
