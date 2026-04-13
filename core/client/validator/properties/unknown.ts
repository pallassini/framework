import type { InputSchema } from "./defs";

/** Nessun controllo (escape hatch). */
export function unknown(): InputSchema<unknown> {
	return { parse: (raw) => raw };
}
