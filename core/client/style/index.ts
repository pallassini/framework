import "./client-config-style";
export type { SmoothScrollConfig, SmoothScrollTune } from "./smooth-scroll";
export {
	map,
	styleMap,
	type StyleGroup,
	type StyleResolver,
	type StyleResolverContext,
	type StyleVariantKey,
} from "./properties";
export { resolveClasses, resolveToken, parseStyleToken } from "./resolve";
export { tokenizeStyleString } from "./tokenize-style";
export {
	resolveStyleInput,
	resolveStyleString,
	activeTokensFromString,
	unwrapConditional,
	condenseConditionalTokenMap,
	STYLE_BASE_ALWAYS_KEY,
	type StyleInput,
	type StyleLayerInput,
	type StyleBaseSegment,
	type Conditional,
	type AnimateInput,
	type ResolvedStyle,
} from "./layer-resolve";
export type { StyleViewport, Device } from "./viewport";
export {
	viewport,
	mob,
	tab,
	des,
	getViewportSize,
	BREAKPOINTS,
	styleViewport,
	device,
	onlyDes,
} from "./viewport";
export type {
	AnimateConfig,
	AnimatePreset,
	AnimateTrackStop,
	BuildAnimationOptions,
	KeyframeStep,
	AnimationResult,
	AnimationTimelineLayer,
	TransitionConfig,
} from "./animation";
import type { Properties } from "csstype";
import { watch } from "../state/effect";
import { isSignal, type Signal } from "../state/state/signal";
import { onNodeDispose } from "../runtime/logic/lifecycle";
import { clearMediaBlend, flushMediaBlendAfterStyle } from "../runtime/tag/tags/media/blend";
import { clearVideoEdgeFade, flushVideoEdgeFadeAfterStyle } from "../runtime/tag/tags/media/video-edge-fade";
import { condenseConditionalTokenMap, resolveStyleInput, type StyleInput, type StyleLayerInput, type ResolvedStyle } from "./layer-resolve";
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
	const durs = style.animationDuration;
	if (durs) style.animationDuration = durs.replace(/\d+ms/g, "1ms");
	const dels = style.animationDelay;
	if (dels) style.animationDelay = dels.replace(/\d+ms/g, "1ms");
}

function clearS(el: El): void {
	if (el instanceof HTMLElement) {
		clearMediaBlend(el);
		clearVideoEdgeFade(el);
	}
	clearMapStyles(el);
	el.removeAttribute("class");
	el.removeAttribute("data-fw-layers");
}

function unwrapStyleReactive(v: unknown): unknown {
	if (v == null || v === false) return v;
	if (typeof v === "function" && !isSignal(v)) return (v as () => unknown)();
	if (isSignal(v)) return (v as Signal<unknown>)();
	if (Array.isArray(v)) {
		/** `[() => boolean, suffix]` — condizione prima (boolean reattivo), poi valore per la chiave (es. `bg`). */
		if (
			v.length === 2 &&
			typeof v[0] === "function" &&
			!isSignal(v[0]) &&
			typeof v[1] !== "function" &&
			!isSignal(v[1])
		) {
			if (!(v[0] as () => unknown)()) return undefined;
			return unwrapStyleReactive(v[1]);
		}
		/** `[suffix, () => boolean | Signal]` — stesso significato, valore prima (utile in `base: [...]`). */
		if (
			v.length === 2 &&
			typeof v[0] !== "function" &&
			!isSignal(v[0]) &&
			(typeof v[1] === "function" || isSignal(v[1]))
		) {
			const c = v[1];
			const ok = isSignal(c) ? !!(c as Signal<unknown>)() : !!(c as () => unknown)();
			if (!ok) return undefined;
			return unwrapStyleReactive(v[0]);
		}
		return v.map(unwrapStyleReactive);
	}
	if (typeof v === "object") {
		const o = v as Record<string, unknown>;
		const condensed = condenseConditionalTokenMap(o, (x) => unwrapStyleReactive(x));
		if (condensed !== null) return condensed;
		const out: Record<string, unknown> = {};
		for (const [k, val] of Object.entries(o)) {
			out[k] = unwrapStyleReactive(val);
		}
		return out;
	}
	return v;
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

	if (el instanceof HTMLElement) {
		flushMediaBlendAfterStyle(el);
		flushVideoEdgeFadeAfterStyle(el);
	}
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

	if (typeof v === "object" && v !== null) {
		applyFromResolved(el, resolveStyleInput(v as StyleLayerInput, vp));
		return;
	}

	clearS(el);
}

/**
 * Applica `s` e si aggiorna su resize (viewport) e su Signal / funzione.
 * Se `s` è `() => layer`, il layer viene rieseguito a ogni tick (usa `persistState.x == y` nel body, non un oggetto letterale fisso).
 */
export function applyStyle(el: El, v: unknown): void {
	if (v == null || v === false) return;

	const read = (): unknown => {
		if (typeof v === "function") return unwrapStyleReactive((v as () => unknown)());
		if (isSignal(v)) return unwrapStyleReactive((v as Signal<unknown>)());
		if (typeof v === "object" && v !== null) return unwrapStyleReactive(v);
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
