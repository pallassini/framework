import { onNodeDispose } from "../../logic/lifecycle";

type El = HTMLElement | SVGElement;
type Applier = (el: El, v: unknown) => void;

function isPromiseLike(x: unknown): x is PromiseLike<unknown> {
	return (
		x != null &&
		(typeof x === "object" || typeof x === "function") &&
		typeof (x as PromiseLike<unknown>).then === "function"
	);
}

/**
 * - `function`: listener; se il ritorno è una Promise viene lasciata “fire-and-forget” (`void`).
 * - valore thenable (es. risultato diretto di `server.*()`): al click si fa `void` sulla stessa Promise.
 *   Nota: `click={rpc()}` valuta `rpc()` al render; per eseguire solo al click usa `click={() => rpc()}`.
 */
function normalizeDomEventHandler(v: unknown): EventListener | null {
	if (typeof v === "function") {
		const fn = v as (ev: Event) => unknown;
		return (ev: Event) => {
			const out = fn(ev);
			if (isPromiseLike(out)) void Promise.resolve(out);
		};
	}
	if (isPromiseLike(v)) {
		return () => {
			void Promise.resolve(v);
		};
	}
	return null;
}

export const CLIENT_EVENT_NAMES = [
	"click",
	"dblclick",
	"contextmenu",
	"input",
	"change",
	"submit",
	"keydown",
	"keyup",
	"focus",
	"blur",
	"focusin",
	"focusout",
	"mousedown",
	"mouseup",
	"mouseenter",
	"mouseleave",
	"mousemove",
	"scroll",
	"wheel",
	"touchstart",
	"touchend",
	"touchmove",
] as const satisfies readonly (keyof HTMLElementEventMap)[];

type ClientEventName = (typeof CLIENT_EVENT_NAMES)[number];

const POINTER_ATTR = "data-fw-click";

function addListener(el: El, name: ClientEventName, v: unknown): void {
	const listener = normalizeDomEventHandler(v);
	if (listener == null) return;
	let setPointerAttr = false;
	let setCursor = false;

	if (name === "click") {
		el.setAttribute(POINTER_ATTR, "");
		setPointerAttr = true;
		if (!el.style.cursor) {
			el.style.cursor = "pointer";
			setCursor = true;
		}
	}

	el.addEventListener(name, listener);

	onNodeDispose(el, () => {
		el.removeEventListener(name, listener);
		if (setPointerAttr) el.removeAttribute(POINTER_ATTR);
		if (setCursor) el.style.removeProperty("cursor");
	});
}

export const eventAppliers: Record<string, Applier> = Object.fromEntries(
	CLIENT_EVENT_NAMES.map((name) => [name, (el: El, v: unknown) => addListener(el, name, v)]),
);
