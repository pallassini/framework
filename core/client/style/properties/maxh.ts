import type { Properties } from "csstype";
import { resolveCanvasHeightSuffix } from "./utils/canvas-size";
import { resolveSpacingToken } from "./utils/units";

export function maxh(suffix: string, ctx?: { negative?: boolean }): Properties | undefined {
	if (ctx?.negative) return undefined;
	if (suffix === "auto") return { maxHeight: "fit-content" };
	const canvas = resolveCanvasHeightSuffix(suffix);
	if (canvas) return { maxHeight: canvas };
	const v = resolveSpacingToken(suffix, "y");
	return v ? { maxHeight: v } : undefined;
}
