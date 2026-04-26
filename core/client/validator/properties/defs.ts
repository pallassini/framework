/** Solo per i moduli in `./properties/*` (evita file `types` / `error` in cima al package). */

export class ValidationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "ValidationError";
	}
}

/** Prefisso per messaggi annidati (`campo: …`, `at index 0: …`). */
export function validationErrorWithPrefix(prefix: string, cause: unknown): never {
	if (cause instanceof ValidationError) {
		throw new ValidationError(`${prefix}: ${cause.message}`);
	}
	throw cause;
}

export type InputSchema<I> = { parse: (raw: unknown) => I };

export type InferSchema<S> = S extends InputSchema<infer I> ? I : never;
