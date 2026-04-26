import { array } from "./array";
import { ValidationError, type InputSchema } from "./defs";

/** Accetta un elemento o un array di elementi (stesso schema). */
export function oneOrArray<I>(item: InputSchema<I>): InputSchema<I | I[]> {
	const arr = array(item);
	return {
		parse: (raw) => {
			if (raw == null) throw new ValidationError("expected object or array");
			if (Array.isArray(raw)) return arr.parse(raw);
			return item.parse(raw);
		},
	};
}
