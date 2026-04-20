import { tagFieldType } from "../field-meta";
import { optionalKeepingFieldMeta } from "../chain";
import { ValidationError, type InputSchema } from "./defs";

/** Solo data calendario `YYYY-MM-DD` → `Date` a mezzanotte UTC. */
export type DateOnlySchema = InputSchema<Date> & {
	optional(): InputSchema<Date | undefined>;
};

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export function date(): DateOnlySchema {
	const base: InputSchema<Date> = {
		parse(raw: unknown) {
			if (typeof raw === "string") {
				if (!DATE_ONLY.test(raw)) throw new ValidationError("expected date (YYYY-MM-DD)");
				const d = new Date(`${raw}T00:00:00.000Z`);
				if (Number.isNaN(d.getTime())) throw new ValidationError("expected valid date");
				return d;
			}
			if (raw instanceof Date) {
				if (Number.isNaN(raw.getTime())) throw new ValidationError("expected valid date");
				const y = raw.getUTCFullYear();
				const m = raw.getUTCMonth();
				const day = raw.getUTCDate();
				return new Date(Date.UTC(y, m, day));
			}
			throw new ValidationError("expected date");
		},
	};
	const out = Object.assign(base, {
		optional() {
			return optionalKeepingFieldMeta(base);
		},
	});
	tagFieldType(out, { kind: "date" });
	return out;
}

/** Data e ora: `Date`, stringa ISO, o numero (ms Unix). */
export type DateTimeSchema = InputSchema<Date> & {
	optional(): InputSchema<Date | undefined>;
};

export function datetime(): DateTimeSchema {
	const base: InputSchema<Date> = {
		parse(raw: unknown) {
			if (raw instanceof Date) {
				if (Number.isNaN(raw.getTime())) throw new ValidationError("expected valid datetime");
				return raw;
			}
			if (typeof raw === "string") {
				const d = new Date(raw);
				if (Number.isNaN(d.getTime())) throw new ValidationError("expected valid datetime");
				return d;
			}
			if (typeof raw === "number" && Number.isFinite(raw)) {
				const d = new Date(raw);
				if (Number.isNaN(d.getTime())) throw new ValidationError("expected valid datetime");
				return d;
			}
			throw new ValidationError("expected datetime");
		},
	};
	const out = Object.assign(base, {
		optional() {
			return optionalKeepingFieldMeta(base);
		},
	});
	tagFieldType(out, { kind: "datetime" });
	return out;
}
