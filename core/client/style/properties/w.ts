import type { Properties } from "csstype";
import { resolveCanvasWidthSuffix } from "./utils/canvas-size";
import { resolveSpacingToken } from "./utils/units";

export function w(suffix: string, ctx?: { negative?: boolean }): Properties | undefined {
	if (ctx?.negative) return undefined;
	if (suffix === "auto") return { width: "fit-content" };
	const canvas = resolveCanvasWidthSuffix(suffix);
	if (canvas) return { width: canvas };
	const v = resolveSpacingToken(suffix, "x");
	return v ? { width: v } : undefined;
}
