import type { InputSchema } from "./defs";

export function nullable<I>(inner: InputSchema<I>): InputSchema<I | null> {
	return {
		parse(raw) {
			if (raw === null) return null;
			return inner.parse(raw);
		},
	};
}
