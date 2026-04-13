import { ValidationError, type InputSchema } from "./defs";

export function string(): InputSchema<string> {
	return {
		parse(raw) {
			if (typeof raw !== "string") throw new ValidationError("expected string");
			return raw;
		},
	};
}
