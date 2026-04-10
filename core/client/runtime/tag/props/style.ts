import { applyHover } from "./hover";

type El = HTMLElement | SVGElement;

export function s(el: El, v: unknown): void {
	if (v != null && v !== false) el.setAttribute("class", String(v));
}

export const hover = applyHover;
