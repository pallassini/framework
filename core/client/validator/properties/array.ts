import { ValidationError, type InputSchema } from "./defs";

export function array<I>(item: InputSchema<I>): InputSchema<I[]> {
	return {
		parse(raw) {
			if (!Array.isArray(raw)) throw new ValidationError("expected array");
			return raw.map((el, i) => {
				try {
					return item.parse(el);
				} catch (e) {
					if (e instanceof ValidationError) {
						throw new ValidationError(`at index ${i}: ${e.message}`);
					}
					throw e;
				}
			});
		},
	};
}
