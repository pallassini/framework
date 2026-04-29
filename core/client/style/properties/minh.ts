import type { Properties } from "csstype";
import { resolveCanvasHeightSuffix } from "./utils/canvas-size";
import { resolveSpacingToken } from "./utils/units";

export function minh(suffix: string, ctx?: { negative?: boolean }): Properties | undefined {
	if (ctx?.negative) return undefined;
	if (suffix === "auto") return { minHeight: "fit-content" };
	const canvas = resolveCanvasHeightSuffix(suffix);
	if (canvas) return { minHeight: canvas };
	const v = resolveSpacingToken(suffix, "y");
	return v ? { minHeight: v } : undefined;
}
