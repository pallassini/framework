import type { InputSchema } from "../client/validator/properties/defs";

type Cell<
	T extends Record<string, Record<string, unknown>>,
	K extends keyof T,
	P extends keyof T[K],
> = T[K][P] extends keyof T
	? T[K][P]
	: T[K][P] extends InputSchema<unknown>
		? T[K][P]
		: never;

/** Shape di tutte le tabelle: le stringhe che non sono `v.*` devono essere nomi di tabella presenti nello stesso oggetto. */
export type PlainSchema<T extends Record<string, Record<string, unknown>>> = {
	[K in keyof T]: {
		[P in keyof T[K]]: Cell<T, K, P>;
	};
};

/**
 * Raggruppa le tabelle senza ripetere il nome: le FK si scrivono come `"users"` e TS le vincola a `keyof` lo schema.
 *
 * ```ts
 * export const { users, works } = tables({
 *   users: { email: v.string() },
 *   works: { title: v.string(), authorId: "users" },
 * });
 * ```
 */
export function tables<const T extends Record<string, Record<string, unknown>>>(def: PlainSchema<T> & T): T {
	return def;
}
