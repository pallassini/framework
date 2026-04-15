import type { Properties } from "csstype";
import { resolveSpacingToken } from "./utils/units";

export function maxw(suffix: string, ctx?: { negative?: boolean }): Properties | undefined {
	if (ctx?.negative) return undefined;
	const v = resolveSpacingToken(suffix, "x");
	return v ? { maxWidth: v } : undefined;
}
