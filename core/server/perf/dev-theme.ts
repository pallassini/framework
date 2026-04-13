/** Stessi accenti del box `core/cli/dev/client.ts` (magenta #ff0087). */
export const DEV_THEME = {
	reset: "\x1b[0m",
	magenta: "\x1b[38;2;255;0;135m",
	magentaBold: "\x1b[1;38;2;255;0;135m",
	dim: "\x1b[2m\x1b[38;2;150;150;160m",
	mark: "\x1b[38;2;255;0;135m\u25c6\x1b[0m",
	/** Nome route su riga errore RPC. */
	errRoute: "\x1b[1;38;2;255;80;80m",
	/** Categoria errore (testo leggibile, es. Rate limit). */
	errCategory: "\x1b[1;38;2;255;100;100m",
} as const;
