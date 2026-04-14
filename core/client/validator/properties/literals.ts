import { ValidationError, type InputSchema } from "./defs";

/** Stringa che deve essere una delle opzioni (controllo runtime + tipo `T[number]`). */
export function literals<const T extends readonly [string, ...string[]]>(
	allowed: T,
): InputSchema<T[number]> {
	const set = new Set<string>(allowed);
	return {
		parse(raw) {
			if (typeof raw !== "string" || !set.has(raw)) {
				throw new ValidationError(`expected one of: ${allowed.join(", ")}`);
			}
			return raw as T[number];
		},
	};
}
