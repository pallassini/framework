import type { Properties } from "csstype";
import { resolveSpacingToken } from "./utils/units";

export function w(suffix: string, ctx?: { negative?: boolean }): Properties | undefined {
	if (ctx?.negative) return undefined;
	const v = resolveSpacingToken(suffix, "x");
	return v ? { width: v } : undefined;
}
