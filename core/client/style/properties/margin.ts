import type { Properties } from "csstype";
import { resolveSpacingToken } from "./utils/units";

type Ctx = { negative?: boolean };

function marginSide(key: keyof Properties, suffix: string, kind: Parameters<typeof resolveSpacingToken>[1], ctx?: Ctx): Properties | undefined {
	const v = resolveSpacingToken(suffix, kind, ctx?.negative);
	return v ? ({ [key]: v } as Properties) : undefined;
}

/** Tutti e quattro i lati; longhand invece di `margin` (la shorthand poteva sovrascrivere `right` / `centerx` nello stesso `s`). */
export function margin(suffix: string, ctx?: Ctx): Properties | undefined {
	const v = resolveSpacingToken(suffix, "box", ctx?.negative);
	if (!v) return undefined;
	return { marginTop: v, marginRight: v, marginBottom: v, marginLeft: v };
}

export function marginTop(suffix: string, ctx?: Ctx): Properties | undefined {
	return marginSide("marginTop", suffix, "y", ctx);
}

export function marginRight(suffix: string, ctx?: Ctx): Properties | undefined {
	return marginSide("marginRight", suffix, "x", ctx);
}

export function marginBottom(suffix: string, ctx?: Ctx): Properties | undefined {
	return marginSide("marginBottom", suffix, "y", ctx);
}

export function marginLeft(suffix: string, ctx?: Ctx): Properties | undefined {
	return marginSide("marginLeft", suffix, "x", ctx);
}

export function marginX(suffix: string, ctx?: Ctx): Properties | undefined {
	const v = resolveSpacingToken(suffix, "x", ctx?.negative);
	return v ? { marginLeft: v, marginRight: v } : undefined;
}

export function marginY(suffix: string, ctx?: Ctx): Properties | undefined {
	const v = resolveSpacingToken(suffix, "y", ctx?.negative);
	return v ? { marginTop: v, marginBottom: v } : undefined;
}
