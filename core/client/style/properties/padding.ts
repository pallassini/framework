import type { Properties } from "csstype";
import { resolveSpacingToken } from "./utils/units";

function paddingSide(key: keyof Properties, suffix: string, kind: Parameters<typeof resolveSpacingToken>[1]): Properties | undefined {
	const v = resolveSpacingToken(suffix, kind);
	return v ? ({ [key]: v } as Properties) : undefined;
}

export function padding(suffix: string): Properties | undefined {
	return paddingSide("padding", suffix, "box");
}

export function paddingTop(suffix: string): Properties | undefined {
	return paddingSide("paddingTop", suffix, "y");
}

export function paddingRight(suffix: string): Properties | undefined {
	return paddingSide("paddingRight", suffix, "x");
}

export function paddingBottom(suffix: string): Properties | undefined {
	return paddingSide("paddingBottom", suffix, "y");
}

export function paddingLeft(suffix: string): Properties | undefined {
	return paddingSide("paddingLeft", suffix, "x");
}

export function paddingX(suffix: string): Properties | undefined {
	const v = resolveSpacingToken(suffix, "x");
	return v ? { paddingLeft: v, paddingRight: v } : undefined;
}

export function paddingY(suffix: string): Properties | undefined {
	const v = resolveSpacingToken(suffix, "y");
	return v ? { paddingTop: v, paddingBottom: v } : undefined;
}
