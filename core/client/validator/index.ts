export { v } from "./properties";
/**
 * Tipo per `satisfies`: `v.Enum<["a","b"]>` — `enum` è riservato in TS, non si può esporre come `v.enum<…>` nel merge col valore `v`.
 * A runtime il parse resta `v.enum([...])`.
 */
export namespace v {
	export type Enum<const T extends readonly [string, ...string[]]> = T[number];
}
export type { InferSchema } from "./properties/defs";
