import type { InputSchema } from "./properties/defs";
import { optional as optionalWrap } from "./properties/optional";
import { FIELD_UNIQUE } from "./field-meta";

function hasUnique(sch: InputSchema<unknown>): boolean {
	return typeof sch === "object" && sch !== null && FIELD_UNIQUE in sch;
}

/** Avvolge `optional()` e preserva `FIELD_UNIQUE` per il catalog DB. */
export function optionalKeepingFieldMeta<I>(
	inner: InputSchema<I>,
): InputSchema<I | undefined> {
	const o = optionalWrap(inner);
	if (!hasUnique(inner)) return o;
	return Object.assign(o, { [FIELD_UNIQUE]: true });
}
