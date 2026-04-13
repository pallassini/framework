import { ValidationError, type InputSchema } from "./defs";

export function number(): InputSchema<number> {
	return {
		parse(raw) {
			if (typeof raw !== "number" || Number.isNaN(raw)) {
				throw new ValidationError("expected number");
			}
			return raw;
		},
	};
}

export function integer(): InputSchema<number> {
	return {
		parse(raw) {
			if (typeof raw !== "number" || !Number.isFinite(raw) || !Number.isInteger(raw)) {
				throw new ValidationError("expected integer");
			}
			return raw;
		},
	};
}
