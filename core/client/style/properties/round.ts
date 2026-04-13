import type { Properties } from "csstype";
import { resolveSpacingToken } from "./utils/units";
import { themeCustomPropertyVar } from "./utils/themeVar";

export function round(suffix: string): Properties | undefined {
	const v = resolveSpacingToken(suffix, "radius");
	if (v) return { borderRadius: v };
	const t = themeCustomPropertyVar(suffix);
	return t ? { borderRadius: t } : undefined;
}
