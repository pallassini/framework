import { applyClass } from "../../../style";
import { applyHover } from "./hover";

type El = HTMLElement | SVGElement;

/** Token design system (`m-2`, `row`, …) + class CSS; token not in map restano su `class`. */
export function s(el: El, v: unknown): void {
	applyClass(el, v);
}

export const hover = applyHover;
