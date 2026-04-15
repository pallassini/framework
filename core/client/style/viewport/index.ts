import { createState } from "../../state";
import { signal, type Signal } from "../../state/state/signal";
import { des as desBp } from "./des";
import { mob as mobBp } from "./mob";
import { tab as tabBp } from "./tab";

export type StyleViewport = "mob" | "tab" | "des";

/** Alias di `StyleViewport` per confronti tipo `device() === "mob"`. */
export type Device = StyleViewport;

/** Soglie px (`mob.max`, `tab.min`/`tab.max`, `des.min`). */
export const BREAKPOINTS = { mob: mobBp, tab: tabBp, des: desBp } as const;

export function getViewportSize(): StyleViewport {
	if (typeof window === "undefined") return "des";
	const w = window.innerWidth;
	if (w <= mobBp.max) return "mob";
	if (w <= tabBp.max) return "tab";
	return "des";
}

const _initialVp = getViewportSize();

/**
 * Viewport come gli altri state (`createState`): `viewport.device()`, `viewport.mob()`, …
 * Si aggiorna al resize; la shell è in un `watch` che legge `viewport.device` così anche il Menu si ricalcola.
 */
export const viewport = createState({
	device: _initialVp,
	mob: _initialVp === "mob",
	tab: _initialVp === "tab",
	des: _initialVp === "des",
});

/** Alias ai signal del branch (stesso uso di prima: `device()`, `des()`, …). */
export const device = viewport.device;
export const mob = viewport.mob;
export const tab = viewport.tab;
export const des = viewport.des;

const onlyDesByFragment = new Map<string, Signal<string>>();

function syncViewportSignals(v: StyleViewport): void {
	viewport.device(v);
	viewport.mob(v === "mob");
	viewport.tab(v === "tab");
	viewport.des(v === "des");
	for (const [fragment, sig] of onlyDesByFragment) {
		sig(v === "des" ? fragment : "");
	}
}

/**
 * Testo solo su desktop: `{onlyDes(" WEB")}` come child Signal (reattivo anche senza ricalcolo shell).
 */
export function onlyDes(fragment: string): Signal<string> {
	let s = onlyDesByFragment.get(fragment);
	if (!s) {
		s = signal(_initialVp === "des" ? fragment : "");
		onlyDesByFragment.set(fragment, s);
	}
	return s;
}

let resizeBound = false;

function ensureResizeListener(): void {
	if (typeof window === "undefined" || resizeBound) return;
	resizeBound = true;
	const onResize = (): void => {
		syncViewportSignals(getViewportSize());
	};
	window.addEventListener("resize", onResize);
	window.addEventListener("orientationchange", onResize);
	/** Dopo paint / meta viewport: allinea subito se `innerWidth` era 0 o errato al load del modulo. */
	queueMicrotask(onResize);
	if (typeof requestAnimationFrame === "function") {
		requestAnimationFrame(onResize);
	}
}

if (typeof window !== "undefined") {
	ensureResizeListener();
}

/** Viewport corrente; dentro `watch()` si sottoscrive ai resize. */
export function styleViewport(): StyleViewport {
	ensureResizeListener();
	return viewport.device();
}
