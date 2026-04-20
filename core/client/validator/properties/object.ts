import { readFieldType, tagFieldType, type FieldTypeDesc } from "../field-meta";
import { ValidationError, type InputSchema } from "./defs";

type InferShape<S extends Record<string, InputSchema<unknown>>> = {
	-readonly [K in keyof S]: S[K] extends InputSchema<infer U> ? U : never;
};

export function object<S extends Record<string, InputSchema<unknown>>>(
	shape: S,
): InputSchema<InferShape<S>> {
	const keys = Object.keys(shape) as (keyof S)[];

	const typeShape: Record<string, FieldTypeDesc> = {};
	for (const k of keys) {
		typeShape[k as string] = readFieldType(shape[k]) ?? { kind: "unknown" };
	}

	if (keys.length === 0) {
		const empty: InputSchema<InferShape<S>> = {
			parse(raw) {
				if (raw === undefined || raw === null) return {} as InferShape<S>;
				if (typeof raw !== "object") throw new ValidationError("expected object");
				return {} as InferShape<S>;
			},
		};
		tagFieldType(empty, { kind: "object", shape: typeShape });
		return empty;
	}

	const out: InputSchema<InferShape<S>> = {
		parse(raw) {
			if (typeof raw !== "object" || raw === null) {
				throw new ValidationError("expected object");
			}
			const obj = raw as Record<string, unknown>;
			const res = {} as InferShape<S>;
			for (const key of keys) {
				(res as Record<string, unknown>)[key as string] = shape[key].parse(obj[key as string]);
			}
			return res;
		},
	};
	tagFieldType(out, { kind: "object", shape: typeShape });
	return out;
}
