import type { Properties } from "csstype";
import { resolveSpacingToken } from "./utils/units";

export function gap(suffix: string): Properties | undefined {
	const v = resolveSpacingToken(suffix, "box");
	return v ? { gap: v } : undefined;
}

export function gapx(suffix: string): Properties | undefined {
	const v = resolveSpacingToken(suffix, "x");
	return v ? { columnGap: v } : undefined;
}

export function gapy(suffix: string): Properties | undefined {
	const v = resolveSpacingToken(suffix, "y");
	return v ? { rowGap: v } : undefined;
}
