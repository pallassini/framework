import { onNodeDispose } from "../../logic/lifecycle";

type El = HTMLElement | SVGElement;

function isPromiseLike(x: unknown): x is PromiseLike<unknown> {
	return (
		x != null &&
		(typeof x === "object" || typeof x === "function") &&
		typeof (x as PromiseLike<unknown>).then === "function"
	);
}

/**
 * `mousedown` su `document` (capture): se il target non è dentro `el`, chiama l’handler.
 * Utile per chiudere popover / menu al click fuori (l’elemento con la prop è il confine “dentro”).
 */
export function clickout(el: El, v: unknown): void {
	if (v == null || v === false) return;
	if (typeof v !== "function") return;
	const fn = v as (e: MouseEvent) => unknown;
	const onDown = (e: MouseEvent): void => {
		const t = e.target;
		if (!(t instanceof Node)) return;
		if (el.contains(t)) return;
		const out = fn(e);
		if (isPromiseLike(out)) void Promise.resolve(out);
	};
	document.addEventListener("mousedown", onDown, true);
	onNodeDispose(el, () => document.removeEventListener("mousedown", onDown, true));
}
