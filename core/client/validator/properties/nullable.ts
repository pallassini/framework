import { REF } from "../db-ref";
import { FIELD_OPTIONAL, readFieldType, tagFieldType } from "../field-meta";
import type { InputSchema } from "./defs";

/**
 * Come `optional`: propaga `REF` / `FIELD_OPTIONAL` verso l’esterno così `table({…})`
 * vede ancora la FK (catalog Zig: cascade vs setNull su `.remove` del padre).
 */
export function nullable<I>(inner: InputSchema<I>): InputSchema<I | null> {
	const base: InputSchema<I | null> = {
		parse(raw) {
			if (raw === null) return null;
			return inner.parse(raw);
		},
	};
	const innerType = readFieldType(inner);
	if (innerType) tagFieldType(base, innerType);
	if (typeof inner === "object" && inner !== null) {
		if (REF in inner) {
			Object.assign(base, { [REF]: Reflect.get(inner, REF) });
		}
		if (FIELD_OPTIONAL in inner && Reflect.get(inner, FIELD_OPTIONAL) === true) {
			Object.assign(base, { [FIELD_OPTIONAL]: true as const });
		}
	}
	return base;
}
