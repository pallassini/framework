import { ValidationError, type InputSchema } from "./defs";

export function literal<const T extends string | number | boolean | null>(
	value: T,
): InputSchema<T> {
	return {
		parse(raw) {
			if (raw !== value) throw new ValidationError(`expected literal ${String(value)}`);
			return value;
		},
	};
}
