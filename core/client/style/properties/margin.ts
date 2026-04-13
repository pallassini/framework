import type { Properties } from "csstype";
import { resolveSpacingToken } from "./utils/units";

function marginSide(key: keyof Properties, suffix: string, kind: Parameters<typeof resolveSpacingToken>[1]): Properties | undefined {
	const v = resolveSpacingToken(suffix, kind);
	return v ? ({ [key]: v } as Properties) : undefined;
}

export function margin(suffix: string): Properties | undefined {
	return marginSide("margin", suffix, "box");
}

export function marginTop(suffix: string): Properties | undefined {
	return marginSide("marginTop", suffix, "y");
}

export function marginRight(suffix: string): Properties | undefined {
	return marginSide("marginRight", suffix, "x");
}

export function marginBottom(suffix: string): Properties | undefined {
	return marginSide("marginBottom", suffix, "y");
}

export function marginLeft(suffix: string): Properties | undefined {
	return marginSide("marginLeft", suffix, "x");
}

export function marginX(suffix: string): Properties | undefined {
	const v = resolveSpacingToken(suffix, "x");
	return v ? { marginLeft: v, marginRight: v } : undefined;
}

export function marginY(suffix: string): Properties | undefined {
	const v = resolveSpacingToken(suffix, "y");
	return v ? { marginTop: v, marginBottom: v } : undefined;
}
