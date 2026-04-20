import { REF } from "../db-ref";
import { FIELD_OPTIONAL } from "../field-meta";
import type { InputSchema } from "./defs";

export function optional<I>(inner: InputSchema<I>): InputSchema<I | undefined> {
	const base: InputSchema<I | undefined> = {
		parse(raw) {
			if (raw === undefined) return undefined;
			return inner.parse(raw);
		},
	};
	const o = Object.assign(base, { [FIELD_OPTIONAL]: true as const });
	if (typeof inner === "object" && inner !== null && REF in inner) {
		return Object.assign(o, { [REF]: Reflect.get(inner, REF) }) as InputSchema<I | undefined>;
	}
	return o;
}
