import type { Properties } from "csstype";
import { resolveSpacingToken } from "./utils/units";

type Ctx = { negative?: boolean };

function paddingSide(key: keyof Properties, suffix: string, kind: Parameters<typeof resolveSpacingToken>[1], ctx?: Ctx): Properties | undefined {
	if (ctx?.negative) return undefined;
	const v = resolveSpacingToken(suffix, kind);
	return v ? ({ [key]: v } as Properties) : undefined;
}

export function padding(suffix: string, ctx?: Ctx): Properties | undefined {
	return paddingSide("padding", suffix, "box", ctx);
}

export function paddingTop(suffix: string, ctx?: Ctx): Properties | undefined {
	return paddingSide("paddingTop", suffix, "y", ctx);
}

export function paddingRight(suffix: string, ctx?: Ctx): Properties | undefined {
	return paddingSide("paddingRight", suffix, "x", ctx);
}

export function paddingBottom(suffix: string, ctx?: Ctx): Properties | undefined {
	return paddingSide("paddingBottom", suffix, "y", ctx);
}

export function paddingLeft(suffix: string, ctx?: Ctx): Properties | undefined {
	return paddingSide("paddingLeft", suffix, "x", ctx);
}

export function paddingX(suffix: string, ctx?: Ctx): Properties | undefined {
	if (ctx?.negative) return undefined;
	const v = resolveSpacingToken(suffix, "x");
	return v ? { paddingLeft: v, paddingRight: v } : undefined;
}

export function paddingY(suffix: string, ctx?: Ctx): Properties | undefined {
	if (ctx?.negative) return undefined;
	const v = resolveSpacingToken(suffix, "y");
	return v ? { paddingTop: v, paddingBottom: v } : undefined;
}
