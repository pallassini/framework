import { optionalKeepingFieldMeta } from "../chain";
import { ValidationError, type InputSchema } from "./defs";

export type NumberSchema = InputSchema<number> & {
	optional(): InputSchema<number | undefined>;
};

export function number(): NumberSchema {
	const base: InputSchema<number> = {
		parse(raw) {
			if (typeof raw !== "number" || Number.isNaN(raw)) {
				throw new ValidationError("expected number");
			}
			return raw;
		},
	};
	return Object.assign(base, {
		optional() {
			return optionalKeepingFieldMeta(base);
		},
	});
}
