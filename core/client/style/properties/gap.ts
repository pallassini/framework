import type { Properties } from "csstype";
import { resolveSpacingToken } from "./utils/units";

type Ctx = { negative?: boolean };

export function gap(suffix: string, ctx?: Ctx): Properties | undefined {
	if (ctx?.negative) return undefined;
	const v = resolveSpacingToken(suffix, "box");
	return v ? { gap: v } : undefined;
}

export function gapx(suffix: string, ctx?: Ctx): Properties | undefined {
	if (ctx?.negative) return undefined;
	const v = resolveSpacingToken(suffix, "x");
	return v ? { columnGap: v } : undefined;
}

export function gapy(suffix: string, ctx?: Ctx): Properties | undefined {
	if (ctx?.negative) return undefined;
	const v = resolveSpacingToken(suffix, "y");
	return v ? { rowGap: v } : undefined;
}
