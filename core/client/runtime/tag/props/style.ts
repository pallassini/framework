import { applyStyle } from "../../../style";
import { applyHover } from "./hover";

type El = HTMLElement | SVGElement;

/** Token design system, layer responsive, shorthand (`bg`, …), `animate`; vedi `StyleInput`. */
export function s(el: El, v: unknown): void {
	applyStyle(el, v);
}

export const hover = applyHover;
