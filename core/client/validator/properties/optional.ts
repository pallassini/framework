import { REF } from "../db-ref";
import type { InputSchema } from "./defs";

export function optional<I>(inner: InputSchema<I>): InputSchema<I | undefined> {
	const o: InputSchema<I | undefined> = {
		parse(raw) {
			if (raw === undefined) return undefined;
			return inner.parse(raw);
		},
	};
	if (typeof inner === "object" && inner !== null && REF in inner) {
		return Object.assign(o, { [REF]: Reflect.get(inner, REF) }) as InputSchema<I | undefined>;
	}
	return o;
}
