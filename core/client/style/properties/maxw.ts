import type { Properties } from "csstype";
import { resolveCanvasWidthSuffix } from "./utils/canvas-size";
import { resolveSpacingToken } from "./utils/units";

export function maxw(suffix: string, ctx?: { negative?: boolean }): Properties | undefined {
	if (ctx?.negative) return undefined;
	if (suffix === "auto") return { maxWidth: "fit-content" };
	const canvas = resolveCanvasWidthSuffix(suffix);
	if (canvas) return { maxWidth: canvas };
	const v = resolveSpacingToken(suffix, "x");
	return v ? { maxWidth: v } : undefined;
}
