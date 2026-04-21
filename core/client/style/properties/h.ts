import type { Properties } from "csstype";
import { resolveCanvasHeightSuffix } from "./utils/canvas-size";
import { resolveSpacingToken } from "./utils/units";

export function h(suffix: string, ctx?: { negative?: boolean }): Properties | undefined {
	if (ctx?.negative) return undefined;
	if (suffix === "auto") return { height: "fit-content" };
	const canvas = resolveCanvasHeightSuffix(suffix);
	if (canvas) return { height: canvas };
	const v = resolveSpacingToken(suffix, "y");
	return v ? { height: v } : undefined;
}
