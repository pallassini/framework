type El = HTMLElement | SVGElement;

export function id(el: El, v: unknown): void {
	if (v != null && v !== false) el.setAttribute("id", String(v));
}
