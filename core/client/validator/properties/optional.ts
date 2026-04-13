import type { InputSchema } from "./defs";

export function optional<I>(inner: InputSchema<I>): InputSchema<I | undefined> {
	return {
		parse(raw) {
			if (raw === undefined) return undefined;
			return inner.parse(raw);
		},
	};
}
