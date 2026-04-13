import { ValidationError, type InputSchema } from "./defs";

/** Solo `undefined` / `null` (nessun payload). */
export function empty(): InputSchema<void> {
	return {
		parse(raw) {
			if (raw !== undefined && raw !== null) throw new ValidationError("expected no input");
		},
	};
}
