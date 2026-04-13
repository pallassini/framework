import { ValidationError, type InputSchema } from "./defs";

type InferShape<S extends Record<string, InputSchema<unknown>>> = {
	-readonly [K in keyof S]: S[K] extends InputSchema<infer U> ? U : never;
};

export function object<S extends Record<string, InputSchema<unknown>>>(
	shape: S,
): InputSchema<InferShape<S>> {
	const keys = Object.keys(shape) as (keyof S)[];

	if (keys.length === 0) {
		return {
			parse(raw) {
				if (raw === undefined || raw === null) return {} as InferShape<S>;
				if (typeof raw !== "object") throw new ValidationError("expected object");
				return {} as InferShape<S>;
			},
		};
	}

	return {
		parse(raw) {
			if (typeof raw !== "object" || raw === null) {
				throw new ValidationError("expected object");
			}
			const obj = raw as Record<string, unknown>;
			const out = {} as InferShape<S>;
			for (const key of keys) {
				(out as Record<string, unknown>)[key as string] = shape[key].parse(obj[key as string]);
			}
			return out;
		},
	};
}
