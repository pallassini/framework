import { optionalKeepingFieldMeta } from "../chain";
import { tagFieldType } from "../field-meta";
import { ValidationError, type InputSchema } from "./defs";

/**
 * Stringa con UI **select**; le opzioni vanno su `<Input options={...} field={...} />`
 * (dati runtime), non nello schema.
 */
export type SelectSchema = InputSchema<string> & {
	optional(): InputSchema<string | undefined>;
};

export function select(): SelectSchema {
	const base: InputSchema<string> = {
		parse(raw: unknown) {
			if (typeof raw !== "string") throw new ValidationError("expected string");
			return raw;
		},
	};
	tagFieldType(base, { kind: "select" });
	return Object.assign(base, {
		optional() {
			return optionalKeepingFieldMeta(base) as InputSchema<string | undefined>;
		},
	}) as SelectSchema;
}
