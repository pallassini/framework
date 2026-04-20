import type { Properties } from "csstype";
import type { StyleResolver } from "../properties";

const ALIASES: Record<string, string> = {
	left: "left",
	right: "right",
	top: "top",
	bottom: "bottom",
	center: "center",
	tl: "top left",
	tr: "top right",
	bl: "bottom left",
	br: "bottom right",
	"top-left": "top left",
	"top-right": "top right",
	"bottom-left": "bottom left",
	"bottom-right": "bottom right",
};

/**
 * `origin-left` → `transform-origin: left` (utile per far "scalare" un hover solo verso destra:
 * `origin-left hover:(scale-105)`).
 * Alias: `tl|tr|bl|br` e `top-left|top-right|bottom-left|bottom-right`.
 * Supporta anche valori CSS espliciti: `origin-50%-50%`, `origin-0-0`, ecc.
 */
export const transformOrigin: StyleResolver = (suffix: string): Properties | undefined => {
	const s = suffix.trim();
	if (!s) return undefined;
	const alias = ALIASES[s];
	if (alias) return { transformOrigin: alias };
	const normalized = s.replace(/-/g, " ");
	return { transformOrigin: normalized };
};
