import type { Properties } from "csstype";
import { resolveCanvasWidthSuffix } from "./utils/canvas-size";
import { resolveSpacingToken } from "./utils/units";

export function minw(suffix: string, ctx?: { negative?: boolean }): Properties | undefined {
	if (ctx?.negative) return undefined;
	if (suffix === "auto") return { minWidth: "fit-content" };
	const canvas = resolveCanvasWidthSuffix(suffix);
	if (canvas) return { minWidth: canvas };
	const v = resolveSpacingToken(suffix, "x");
	return v ? { minWidth: v } : undefined;
}
