import { readFieldType, tagFieldType, type FieldTypeDesc } from "../field-meta";
import { optional } from "./optional";
import { ValidationError, type InputSchema } from "./defs";

export type ArraySchema<I> = InputSchema<I[]> & {
	default(value: I[]): ArraySchema<I>;
	optional(): InputSchema<I[] | undefined>;
};

function makeArraySchema<I>(parseImpl: (raw: unknown) => I[], itemType: FieldTypeDesc): ArraySchema<I> {
	const base: InputSchema<I[]> = { parse: parseImpl };
	const out = Object.assign(base, {
		default(def: I[]) {
			return makeArraySchema((raw) => {
				if (raw === undefined) return def.slice();
				return parseImpl(raw);
			}, itemType);
		},
		optional() {
			return optional(base);
		},
	}) as ArraySchema<I>;
	tagFieldType(out, { kind: "array", of: itemType });
	return out;
}

export function array<I>(item: InputSchema<I>): ArraySchema<I> {
	const itemType = readFieldType(item) ?? { kind: "unknown" };
	return makeArraySchema<I>((raw) => {
		if (!Array.isArray(raw)) throw new ValidationError("expected array");
		return raw.map((el, i) => {
			try {
				return item.parse(el);
			} catch (e) {
				if (e instanceof ValidationError) {
					throw new ValidationError(`at index ${i}: ${e.message}`);
				}
				throw e;
			}
		});
	}, itemType);
}
