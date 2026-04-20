import { tagFieldType } from "../field-meta";
import { optionalKeepingFieldMeta } from "../chain";
import { ValidationError, type InputSchema } from "./defs";

/** Stringa che deve essere una delle opzioni (controllo runtime + tipo `T[number]`). */
export type LiteralsSchema<T extends readonly [string, ...string[]]> = InputSchema<T[number]> & {
	optional(): InputSchema<T[number] | undefined>;
	default<D extends T[number]>(value: D): LiteralsSchema<T>;
};

function makeLiteralsSchema<const T extends readonly [string, ...string[]]>(
	allowed: T,
	set: Set<string>,
	parseImpl: (raw: unknown) => T[number],
): LiteralsSchema<T> {
	const base: InputSchema<T[number]> = { parse: parseImpl };
	const out = Object.assign(base, {
		optional() {
			return optionalKeepingFieldMeta(base);
		},
		default(def: T[number]) {
			if (!set.has(def as string)) {
				throw new ValidationError(`default must be one of: ${allowed.join(", ")}`);
			}
			return makeLiteralsSchema(allowed, set, (raw) => {
				if (raw === undefined) return def;
				return parseImpl(raw);
			});
		},
	}) as LiteralsSchema<T>;
	tagFieldType(out, { kind: "enum", options: [...allowed] });
	return out;
}

export function literals<const T extends readonly [string, ...string[]]>(allowed: T): LiteralsSchema<T> {
	const set = new Set<string>(allowed);
	return makeLiteralsSchema(allowed, set, (raw) => {
		if (typeof raw !== "string" || !set.has(raw)) {
			throw new ValidationError(`expected one of: ${allowed.join(", ")}`);
		}
		return raw as T[number];
	});
}
