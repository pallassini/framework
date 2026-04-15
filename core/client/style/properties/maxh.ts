import type { Properties } from "csstype";
import { resolveSpacingToken } from "./utils/units";

export function maxh(suffix: string, ctx?: { negative?: boolean }): Properties | undefined {
	if (ctx?.negative) return undefined;
	const v = resolveSpacingToken(suffix, "y");
	return v ? { maxHeight: v } : undefined;
}
