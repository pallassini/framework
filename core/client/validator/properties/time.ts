import { tagFieldType } from "../field-meta";
import { optionalKeepingFieldMeta } from "../chain";
import { ValidationError, type InputSchema } from "./defs";

/** Solo ora del giorno `HH:MM` o `HH:MM:SS` (24h). Validata come stringa. */
export type TimeOnlySchema = InputSchema<string> & {
	optional(): InputSchema<string | undefined>;
};

const TIME_HM = /^([01]\d|2[0-3]):[0-5]\d$/;
const TIME_HMS = /^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/;

export function time(): TimeOnlySchema {
	const base: InputSchema<string> = {
		parse(raw: unknown) {
			if (typeof raw !== "string") throw new ValidationError("expected time (HH:MM)");
			if (!TIME_HM.test(raw) && !TIME_HMS.test(raw)) {
				throw new ValidationError("expected time (HH:MM or HH:MM:SS)");
			}
			return raw.length === 5 ? `${raw}:00` : raw;
		},
	};
	const out = Object.assign(base, {
		optional() {
			return optionalKeepingFieldMeta(base);
		},
	});
	tagFieldType(out, { kind: "time" });
	return out;
}
