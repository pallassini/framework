import { FIELD_UNIQUE, tagFieldType } from "../field-meta";
import { optionalKeepingFieldMeta } from "../chain";
import { ValidationError, type InputSchema } from "./defs";

function baseParse(raw: unknown): string {
	if (typeof raw !== "string") throw new ValidationError("expected string");
	return raw;
}

/** Schema email/slug con `.unique()` → catalog DB. */
export type StringSchemaUnique = InputSchema<string> & {
	optional(): InputSchema<string | undefined>;
	unique(): StringSchemaUnique;
};

export type StringSchema = InputSchema<string> & {
	optional(): InputSchema<string | undefined>;
	unique(): StringSchemaUnique;
};

export function string(): StringSchema {
	const base: InputSchema<string> = {
		parse(raw: unknown) {
			return baseParse(raw);
		},
	};

	const out = Object.assign(base, {
		optional() {
			return optionalKeepingFieldMeta(base);
		},
		unique(): StringSchemaUnique {
			const u = {
				parse(raw: unknown) {
					return baseParse(raw);
				},
				[FIELD_UNIQUE]: true as const,
				optional() {
					return optionalKeepingFieldMeta(u);
				},
				unique(): StringSchemaUnique {
					return u as StringSchemaUnique;
				},
			};
			tagFieldType(u, { kind: "string" });
			return u as StringSchemaUnique;
		},
	});

	tagFieldType(out, { kind: "string" });
	return out as StringSchema;
}
