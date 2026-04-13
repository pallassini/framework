import type { Properties } from "csstype";
import { resolveSpacingToken } from "./utils/units";

export function minw(suffix: string): Properties | undefined {
	const v = resolveSpacingToken(suffix, "x");
	return v ? { minWidth: v } : undefined;
}
