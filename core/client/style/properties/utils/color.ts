import { themeCustomPropertyVar } from "./themeVar";

/** Valori colore usabili in CSS (hex, funzioni, token tema). */
export type ColorHex = `#${string}`;
export type ColorValue =
	| ColorHex
	| `rgb(${string})`
	| `rgba(${string})`
	| `var(--${string})`
	| "transparent"
	/** Keyword CSS: vale come il `color` calcolato dell’elemento (spesso ereditato). */
	| "currentColor";

const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

/** Suffisso token (`bg-#fff`, `b-rgba(...)`, `bg-background` → `var(--background)`) → valore CSS sicuro per colore. */
export function resolveColorToken(s: string): string | null {
	if (!s) return null;
	if (s === "transparent" || s === "currentColor") return s;
	if (/^var\(--[\w-]+\)$/.test(s)) return s;
	if (HEX_RE.test(s)) return s;
	if (/^(rgb|rgba|hsl|hsla)\(/.test(s)) return s;
	return themeCustomPropertyVar(s);
}
