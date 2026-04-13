import { ValidationError, type InputSchema } from "./defs";

export function boolean(): InputSchema<boolean> {
	return {
		parse(raw) {
			if (typeof raw !== "boolean") throw new ValidationError("expected boolean");
			return raw;
		},
	};
}
