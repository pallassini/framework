import { resolveBaseSpacingSuffix } from "./base-spacing";
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

function negateSpacingCssValue(v: string): string | null {
	if (v === "auto") return null;
	if (isCssVarToken(v)) return `calc(${v} * -1)`;
	if (v === "0") return "0";
	return `-${v}`;
}

/**
 * Suffisso → valore CSS: keyword, lunghezze esplicite, `var()`, scala **1–5** (`kind` decide vw/vh/vmin…).
 * Con `negative`, il valore è invertito di segno (`-mt-11vh` → `-11vh`; `auto` non è ammesso).
 */
export function resolveSpacingToken(s: string, kind: SpacingScaleKind = "box", negative?: boolean): string | null {
	let out: string | null = null;
	if (isSpacingKeyword(s)) out = s;
	else if (CSS_LENGTH_RE.test(s)) out = s;
	else if (isCssVarToken(s)) out = s;
	else {
		const baseV = resolveBaseSpacingSuffix(s);
		if (baseV != null) out = baseV;
		else {
			const step = parseScaleSuffix(s);
			if (step != null) {
				const v = scaleStep(kind, step);
				if (v) out = v;
			}
		}
	}
	if (out == null) return null;
	if (!negative) return out;
	return negateSpacingCssValue(out);
}
