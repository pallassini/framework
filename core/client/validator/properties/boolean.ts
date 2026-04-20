import { tagFieldType } from "../field-meta";
import { optional } from "./optional";
import { ValidationError, type InputSchema } from "./defs";

export type BooleanSchema = InputSchema<boolean> & {
	default<D extends boolean>(value: D): BooleanSchema;
	optional(): InputSchema<boolean | undefined>;
};

function makeBooleanSchema(parseImpl: (raw: unknown) => boolean): BooleanSchema {
	const base: InputSchema<boolean> = { parse: parseImpl };
	const out = Object.assign(base, {
		optional() {
			return optional(base);
		},
		default(def: boolean) {
			return makeBooleanSchema((raw) => {
				if (raw === undefined) return def;
				return parseImpl(raw);
			});
		},
	}) as BooleanSchema;
	tagFieldType(out, { kind: "boolean" });
	return out;
}

export function boolean(): BooleanSchema {
	return makeBooleanSchema((raw) => {
		if (typeof raw !== "boolean") throw new ValidationError("expected boolean");
		return raw;
	});
}
