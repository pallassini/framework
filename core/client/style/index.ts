export { map, styleMap, type StyleGroup, type StyleResolver, type StyleVariantKey } from "./properties";
export { resolveClasses, resolveToken, parseStyleToken } from "./resolve";
export {
	resolveStyleInput,
	resolveStyleString,
	activeTokensFromString,
	tokenizeStyleString,
	unwrapConditional,
	type StyleInput,
	type StyleLayerInput,
	type Conditional,
	type AnimateInput,
	type ResolvedStyle,
} from "./layer-resolve";
export type { StyleViewport } from "./viewport";
export { mob, tab, des, getViewportSize, BREAKPOINTS, styleViewport } from "./viewport";
export type { AnimateConfig, AnimatePreset, KeyframeStep, AnimationResult, TransitionConfig } from "./animation";

import type { Properties } from "csstype";
import { watch } from "../state/effect";
import { isSignal, type Signal } from "../state/state/signal";
import { onNodeDispose } from "../runtime/logic/lifecycle";
import { resolveStyleInput, type StyleLayerInput, type ResolvedStyle } from "./layer-resolve";
import { styleViewport } from "./viewport";

type El = HTMLElement | SVGElement;

const managedStyleKeys = new WeakMap<El, Set<string>>();

function camelToKebab(prop: string): string {
	return prop.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase());
}

function clearMapStyles(el: El): void {
	const prev = managedStyleKeys.get(el);
	if (!prev) return;
	for (const k of prev) {
		el.style.removeProperty(camelToKebab(k));
	}
	managedStyleKeys.delete(el);
}

function applyMapStyles(el: El, props: Properties): void {
	const prev = managedStyleKeys.get(el) ?? new Set<string>();
	const next = new Set(Object.keys(props));
	for (const k of prev) {
		if (!next.has(k)) el.style.removeProperty(camelToKebab(k));
	}
	for (const [k, v] of Object.entries(props)) {
		if (v == null || v === false || v === "") continue;
		el.style.setProperty(camelToKebab(k), String(v));
	}
	managedStyleKeys.set(el, next);
}

function applyReducedMotion(style: Record<string, string>): void {
	if (typeof window === "undefined") return;
	if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
	const a = style.animation;
	if (a) style.animation = a.replace(/\d+ms/g, "1ms");
}

function clearS(el: El): void {
	clearMapStyles(el);
	el.removeAttribute("class");
	el.removeAttribute("data-fw-layers");
}

function applyFromResolved(el: El, resolved: ResolvedStyle): void {
	const style = { ...resolved.style };
	applyReducedMotion(style);

	if (resolved.layers) el.setAttribute("data-fw-layers", "");
	else el.removeAttribute("data-fw-layers");

	applyMapStyles(el, style as Properties);

	const cls = resolved.classes.filter(Boolean).join(" ");
	if (cls) el.setAttribute("class", cls);
	else el.removeAttribute("class");
}

/** Applica `s` (stringa, layer oggetto, numero) al viewport corrente. */
export function applyStyleImmediate(el: El, v: unknown): void {
	if (v == null || v === false) {
		clearS(el);
		return;
	}

	const vp = styleViewport();

	if (typeof v === "string" || typeof v === "number") {
		applyFromResolved(el, resolveStyleInput(String(v), vp));
		return;
	}

	if (typeof v === "object" && !Array.isArray(v)) {
		applyFromResolved(el, resolveStyleInput(v as StyleLayerInput, vp));
		return;
	}

	clearS(el);
}

/**
 * Applica `s` e si aggiorna su resize (viewport) e su Signal / funzione.
 */
export function applyStyle(el: El, v: unknown): void {
	if (v == null || v === false) return;

	const read = (): unknown => {
		if (typeof v === "function") return (v as () => unknown)();
		if (isSignal(v)) return (v as Signal<unknown>)();
		return v;
	};

	const stop = watch(() => {
		const out = read();
		if (out == null || out === false) clearS(el);
		else applyStyleImmediate(el, out);
	});
	onNodeDispose(el, () => {
		stop();
		clearS(el);
	});
}

/** @deprecated Usare `applyStyle`; mantenuto come alias. */
export const applyClass = applyStyle;
