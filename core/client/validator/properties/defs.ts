/** Solo per i moduli in `./properties/*` (evita file `types` / `error` in cima al package). */

export class ValidationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "ValidationError";
	}
}

export type InputSchema<I> = { parse: (raw: unknown) => I };

export type InferSchema<S> = S extends InputSchema<infer I> ? I : never;
