import { tagFieldType, readFieldType } from "../field-meta";
import { optionalKeepingFieldMeta } from "../chain";
import { ValidationError, type InputSchema } from "./defs";

/**
 * Helper: clona lo schema `src` ereditando i metadati (`min`/`max`/`int`/`step`)
 * dal sorgente e mergiando quelli nuovi (`patch`). Così ogni `.min()/.max()/
 * .int()/.step()/.nonnegative()/.nonpositive()` propaga i constraint verso le UI
 * (es. `<Input type="number" field={...}>` deduce min/max da solo).
 */
function mergeNumberMeta(
	src: object,
	dst: object,
	patch: { min?: number; max?: number; int?: boolean; step?: number },
): void {
	const prev = readFieldType(src);
	const base = prev && prev.kind === "number" ? prev : { kind: "number" as const };
	tagFieldType(dst, { ...base, ...patch });
}

function baseParse(raw: unknown): number {
	if (typeof raw !== "number" || Number.isNaN(raw)) {
		const received =
			raw === null ? "null" : raw === undefined ? "undefined" : typeof raw;
		throw new ValidationError(`expected number (received ${received})`);
	}
	return raw;
}

/**
 * Schema numerico con catena di controlli (`.min`, `.max`, `.int`, …).
 * Ogni metodo ritorna un nuovo `NumberSchema` con la regola accumulata nel `parse`.
 */
export type NumberSchema = InputSchema<number> & {
	optional(): InputSchema<number | undefined>;
	/** Valore minimo (inclusivo). */
	min(n: number, message?: string): NumberSchema;
	/** Valore massimo (inclusivo). */
	max(n: number, message?: string): NumberSchema;
	/** Strettamente maggiore di `n`. */
	gt(n: number, message?: string): NumberSchema;
	/** Strettamente minore di `n`. */
	lt(n: number, message?: string): NumberSchema;
	/** Deve essere intero. */
	int(message?: string): NumberSchema;
	/** Deve essere finito (esclude ±Infinity). */
	finite(message?: string): NumberSchema;
	/** Deve essere positivo (> 0). */
	positive(message?: string): NumberSchema;
	/** Deve essere negativo (< 0). */
	negative(message?: string): NumberSchema;
	/** Deve essere ≥ 0. */
	nonnegative(message?: string): NumberSchema;
	/** Deve essere ≤ 0. */
	nonpositive(message?: string): NumberSchema;
	/** Deve essere multiplo di `step` (per es. `step(0.5)` permette 0, 0.5, 1, …). */
	step(step: number, message?: string): NumberSchema;
	/** Valore ammesso solo se incluso in `values`. */
	oneOf(values: readonly number[], message?: string): NumberSchema;
};

function makeNumberSchema(parseImpl: (raw: unknown) => number): NumberSchema {
	const derive = (next: (n: number) => number): NumberSchema =>
		makeNumberSchema((raw) => next(parseImpl(raw)));

	const base: InputSchema<number> = { parse: parseImpl };
	const out = Object.assign(base, {
		optional() {
			return optionalKeepingFieldMeta(base);
		},

		min(n: number, message?: string) {
			const next = derive((x) => {
				if (x < n) {
					throw new ValidationError(message ?? `must be ≥ ${n}`);
				}
				return x;
			});
			mergeNumberMeta(out, next, { min: n });
			return next;
		},
		max(n: number, message?: string) {
			const next = derive((x) => {
				if (x > n) {
					throw new ValidationError(message ?? `must be ≤ ${n}`);
				}
				return x;
			});
			mergeNumberMeta(out, next, { max: n });
			return next;
		},
		gt(n: number, message?: string) {
			const next = derive((x) => {
				if (!(x > n)) {
					throw new ValidationError(message ?? `must be > ${n}`);
				}
				return x;
			});
			mergeNumberMeta(out, next, { min: n });
			return next;
		},
		lt(n: number, message?: string) {
			const next = derive((x) => {
				if (!(x < n)) {
					throw new ValidationError(message ?? `must be < ${n}`);
				}
				return x;
			});
			mergeNumberMeta(out, next, { max: n });
			return next;
		},
		int(message?: string) {
			const next = derive((x) => {
				if (!Number.isInteger(x)) {
					throw new ValidationError(message ?? `must be an integer`);
				}
				return x;
			});
			mergeNumberMeta(out, next, { int: true });
			return next;
		},
		finite(message?: string) {
			return derive((x) => {
				if (!Number.isFinite(x)) {
					throw new ValidationError(message ?? `must be a finite number`);
				}
				return x;
			});
		},
		positive(message?: string) {
			const next = derive((x) => {
				if (!(x > 0)) {
					throw new ValidationError(message ?? `must be positive`);
				}
				return x;
			});
			mergeNumberMeta(out, next, { min: 0 });
			return next;
		},
		negative(message?: string) {
			const next = derive((x) => {
				if (!(x < 0)) {
					throw new ValidationError(message ?? `must be negative`);
				}
				return x;
			});
			mergeNumberMeta(out, next, { max: 0 });
			return next;
		},
		nonnegative(message?: string) {
			const next = derive((x) => {
				if (x < 0) {
					throw new ValidationError(message ?? `must be ≥ 0`);
				}
				return x;
			});
			mergeNumberMeta(out, next, { min: 0 });
			return next;
		},
		nonpositive(message?: string) {
			const next = derive((x) => {
				if (x > 0) {
					throw new ValidationError(message ?? `must be ≤ 0`);
				}
				return x;
			});
			mergeNumberMeta(out, next, { max: 0 });
			return next;
		},
		step(step: number, message?: string) {
			const next = derive((x) => {
				/** Tolleranza per evitare falsi positivi su numeri floating. */
				const r = x / step;
				if (Math.abs(r - Math.round(r)) > 1e-9) {
					throw new ValidationError(message ?? `must be multiple of ${step}`);
				}
				return x;
			});
			mergeNumberMeta(out, next, { step });
			return next;
		},
		oneOf(values: readonly number[], message?: string) {
			return derive((x) => {
				if (!values.includes(x)) {
					throw new ValidationError(
						message ?? `must be one of: ${values.join(", ")}`,
					);
				}
				return x;
			});
		},
	}) as NumberSchema;

	tagFieldType(out, { kind: "number" });
	return out;
}

export function number(): NumberSchema {
	return makeNumberSchema(baseParse);
}
