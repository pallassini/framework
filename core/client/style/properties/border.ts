import type { Properties } from "csstype";
import { resolveBorderScaleSuffix } from "./utils/border-scale";
import { resolveColorToken } from "./utils/color";
import { resolveSpacingToken } from "./utils/units";

type BorderCtx = { negative?: boolean };

/**
 * Larghezza (`b-1`, `b-2px`), colore (`b-#fff`), … Il glow animato è **`b-animated(…)`** (token separato).
 */
export function border(suffix: string, ctx?: BorderCtx): Properties | undefined {
	if (ctx?.negative) return undefined;
	if (!suffix) return { borderStyle: "solid", borderWidth: "1px" };
	if (/^animated\s*\(/i.test(suffix)) return undefined;

	const scaled = resolveBorderScaleSuffix(suffix);
	if (scaled) return { borderStyle: "solid", borderWidth: scaled };

	const width = resolveSpacingToken(suffix, "box");
	if (width) return { borderStyle: "solid", borderWidth: width };

	const color = resolveColorToken(suffix);
	if (color) return { borderColor: color };

	return undefined;
}

type Side = "Top" | "Right" | "Bottom" | "Left";

function borderOneSide(side: Side, suffix: string, ctx?: BorderCtx): Properties | undefined {
	if (ctx?.negative) return undefined;
	const wKey = `border${side}Width` as const;
	const sKey = `border${side}Style` as const;
	const cKey = `border${side}Color` as const;

	if (!suffix) return { [sKey]: "solid", [wKey]: "1px" } as Properties;

	const scaled = resolveBorderScaleSuffix(suffix);
	if (scaled) return { [sKey]: "solid", [wKey]: scaled } as Properties;

	const width = resolveSpacingToken(suffix, "box");
	if (width) return { [sKey]: "solid", [wKey]: width } as Properties;

	const color = resolveColorToken(suffix);
	if (color) return { [cKey]: color } as Properties;

	return undefined;
}

/** Bordo superiore: come `b` ma solo `border-top-*` (`bt-1px`, `bt-#fff`). */
export function borderTop(suffix: string, ctx?: BorderCtx): Properties | undefined {
	return borderOneSide("Top", suffix, ctx);
}

/** Bordo destro. */
export function borderRight(suffix: string, ctx?: BorderCtx): Properties | undefined {
	return borderOneSide("Right", suffix, ctx);
}

/** Bordo inferiore. */
export function borderBottom(suffix: string, ctx?: BorderCtx): Properties | undefined {
	return borderOneSide("Bottom", suffix, ctx);
}

/** Bordo sinistro. */
export function borderLeft(suffix: string, ctx?: BorderCtx): Properties | undefined {
	return borderOneSide("Left", suffix, ctx);
}
