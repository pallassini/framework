import { parseScaleSuffix, scaleStep, type SpacingScaleKind } from "./scale";

/** Numero + unità (stringa già pronta per il CSS). */
export const CSS_LENGTH_RE = /^[\d.]+(px|rem|em|%|vw|vh|vmin|vmax|ch|ex)$/;

export function isCssVarToken(s: string): boolean {
	return /^var\(--[\w-]+\)$/.test(s);
}

export function isSpacingKeyword(s: string): boolean {
	return s === "auto" || s === "0";
}

export type { SpacingScaleKind };

/**
 * Suffisso → valore CSS: keyword, lunghezze esplicite, `var()`, scala **1–5** (`kind` decide vw/vh/vmin…).
 */
export function resolveSpacingToken(s: string, kind: SpacingScaleKind = "box"): string | null {
	if (isSpacingKeyword(s)) return s;
	if (CSS_LENGTH_RE.test(s)) return s;
	if (isCssVarToken(s)) return s;
	const step = parseScaleSuffix(s);
	if (step != null) {
		const v = scaleStep(kind, step);
		if (v) return v;
	}
	return null;
}
