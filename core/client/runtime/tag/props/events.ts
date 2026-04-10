import { onNodeDispose } from "../../logic/lifecycle";

type El = HTMLElement | SVGElement;
type Applier = (el: El, v: unknown) => void;

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
	if (typeof v !== "function") return;

	const listener = v as EventListener;
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
