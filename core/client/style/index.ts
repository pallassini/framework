import "./client-config-style";
export type { SmoothScrollConfig, SmoothScrollTune } from "./smooth-scroll";
export { setSmoothScrollInteractionLock } from "./smooth-scroll";
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
	recombineStringSpreadInTokenMap,
	STYLE_BASE_ALWAYS_KEY,
	STYLE_BASE_SUFFIX_KEY,
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
export {
	clearAnimationLifecycle,
	fwAnimateDebugEnabled,
	fwAnimateDebugLog,
	fwAnimateDebugRefreshCache,
	fwLifecycleDebugLog,
	syncAnimationLifecycle,
} from "./animation";
import type { Properties } from "csstype";
import { watch } from "../state/effect";
import { isSignal, type Signal } from "../state/state/signal";
import { onNodeDispose } from "../runtime/logic/lifecycle";
import { clearMediaBlend, flushMediaBlendAfterStyle } from "../runtime/tag/tags/media/blend";
import { clearVideoEdgeFade, flushVideoEdgeFadeAfterStyle } from "../runtime/tag/tags/media/video-edge-fade";
import {
	clearAnimationLifecycle,
	fwLifecycleDebugLog,
	syncAnimationLifecycle,
} from "./animation";
import { condenseConditionalTokenMap, resolveStyleInput, type StyleInput, type StyleLayerInput, type ResolvedStyle } from "./layer-resolve";
import { mob, styleViewport } from "./viewport";

type El = HTMLElement | SVGElement;

const managedStyleKeys = new WeakMap<El, Set<string>>();
const managedStyleClasses = new WeakMap<El, string>();

function normalizeClassString(raw: string | null | undefined): string {
	return (raw ?? "").trim().replace(/\s+/g, " ");
}

function subtractClassString(full: string, sub: string): string {
	const f = normalizeClassString(full);
	const s = normalizeClassString(sub);
	if (!s) return f;
	const fullSet = new Set(f.split(" ").filter(Boolean));
	for (const c of s.split(" ").filter(Boolean)) fullSet.delete(c);
	return [...fullSet].join(" ");
}

function mergeUserAndStyleClasses(el: El, nextStyleClass: string): string {
	const prevStyle = managedStyleClasses.get(el) ?? "";
	const current = el.getAttribute("class") ?? "";
	const user = subtractClassString(current, prevStyle);
	const parts = [normalizeClassString(user), normalizeClassString(nextStyleClass)].filter(Boolean);
	const merged = parts.join(" ").trim();
	managedStyleClasses.set(el, normalizeClassString(nextStyleClass));
	return merged;
}

const overlayInteractionCleanup = new WeakMap<El, () => void>();

function mobViewport(): boolean {
	return mob();
}

function teardownOverlays(el: El): void {
	const d = overlayInteractionCleanup.get(el);
	if (d) {
		d();
		overlayInteractionCleanup.delete(el);
	}
}

/** Base + overlay: unisce `transform` (es. `absolute center` + `scale` in hover). */
function mergeOverlayStyle(
	base: Record<string, string>,
	overlay: Record<string, string>,
): Record<string, string> {
	const out = { ...base, ...overlay };
	const bt = base.transform;
	const ot = overlay.transform;
	if (bt && ot) {
		out.transform = `${bt} ${ot}`.trim();
	}
	return out;
}

/**
 * `hover` (mouse) e `focus` (focusin/focusout, come `:focus-within`) sull’elemento
 * o sui figli. Ordine merge: `base` → `hover?` → `focus?` (l’ultimo vince su stesse chiavi).
 */
function attachOverlays(el: El, resolved: ResolvedStyle): void {
	teardownOverlays(el);
	const hovR = resolved.hover;
	const focR = resolved.focus;
	if (!hovR && !focR) return;

	const hovSt = hovR ? { ...hovR.style } : null;
	const hovCls = hovR?.classes?.filter(Boolean).join(" ").trim() ?? "";
	const hovUse =
		!!(hovSt && Object.keys(hovSt).length > 0) || hovCls.length > 0;

	const focSt = focR ? { ...focR.style } : null;
	const focCls = focR?.classes?.filter(Boolean).join(" ").trim() ?? "";
	const focUse = !!(focSt && Object.keys(focSt).length > 0) || focCls.length > 0;

	if (!hovUse && !focUse) return;

	const baseStyle = { ...resolved.style };
	const baseClass = resolved.classes.filter(Boolean).join(" ").trim();
	const layersOn =
		resolved.layers ||
		(focR && focR.layers) ||
		(hovR && hovR.layers) ||
		false;

	const applyComposed = (hovering: boolean, focusWithin: boolean): void => {
		const useHover = hovering && hovR && hovUse && !mobViewport();
		const useFocus = focusWithin && focUse;
		let next = { ...baseStyle };
		if (useHover && hovSt) {
			next = mergeOverlayStyle(next, hovSt);
		}
		if (useFocus && focSt) {
			next = mergeOverlayStyle(next, focSt);
		}
		applyMapStyles(el, next as Properties);
		if (layersOn) el.setAttribute("data-fw-layers", "");
		else el.removeAttribute("data-fw-layers");
		const parts: string[] = [];
		if (baseClass) parts.push(baseClass);
		if (useHover && hovCls) parts.push(hovCls);
		if (useFocus && focCls) parts.push(focCls);
		const styleCls = parts.join(" ").trim();
		const cls = mergeUserAndStyleClasses(el, styleCls);
		if (cls) el.setAttribute("class", cls);
		else el.removeAttribute("class");
	};

	const readPointerHover = (): boolean => {
		if (!hovR || !hovUse) return false;
		return typeof el.matches === "function" && el.matches(":hover");
	};

	const readFocusWithin = (): boolean => {
		if (!focUse) return false;
		/** Portali (Date/Time picker): attributo impostato dal componente mentre il pannello è aperto. */
		if (
			el instanceof HTMLElement &&
			el.hasAttribute("data-fw-shell-pseudo-focus-within")
		) {
			return true;
		}
		return typeof el.matches === "function" && (el as Element).matches(":focus-within");
	};

	applyComposed(readPointerHover(), readFocusWithin());

	const cleanups: Array<() => void> = [];

	if (hovR && hovUse) {
		const onEnter = (): void => {
			applyComposed(true, readFocusWithin());
		};
		const onLeave = (): void => {
			applyComposed(false, readFocusWithin());
			if (el instanceof HTMLElement) {
				flushMediaBlendAfterStyle(el);
				flushVideoEdgeFadeAfterStyle(el);
			}
		};
		el.addEventListener("mouseenter", onEnter);
		el.addEventListener("mouseleave", onLeave);
		cleanups.push(() => {
			(el as Element).removeEventListener("mouseenter", onEnter);
			(el as Element).removeEventListener("mouseleave", onLeave);
		});
	}

	if (focR && focUse) {
		const onFocusIn = (): void => {
			applyComposed(readPointerHover(), readFocusWithin());
		};
		const onFocusOut = (): void => {
			applyComposed(readPointerHover(), readFocusWithin());
		};
		el.addEventListener("focusin", onFocusIn);
		el.addEventListener("focusout", onFocusOut);
		cleanups.push(() => {
			(el as Element).removeEventListener("focusin", onFocusIn);
			(el as Element).removeEventListener("focusout", onFocusOut);
		});
	}

	overlayInteractionCleanup.set(el, () => {
		for (const c of cleanups) c();
	});
}

function camelToKebab(prop: string): string {
	if (prop.startsWith("--")) return prop;
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

/** Valori tipo `900ms`, `0.9s`, `0` dalla lista CSS animation-* (virgole). */
function parseCssTimeListMs(raw: string): number[] | null {
	const parts = raw.split(",").map((s) => {
		const t = s.trim();
		const ms = t.match(/^([\d.]+)ms$/i);
		if (ms) return parseFloat(ms[1]!);
		const sec = t.match(/^([\d.]+)s$/i);
		if (sec) return parseFloat(sec[1]!) * 1000;
		const n = parseFloat(t);
		return Number.isFinite(n) ? n : 0;
	});
	return parts.length ? parts : null;
}

function applyReducedMotion(style: Record<string, string>): void {
	if (typeof window === "undefined") return;
	if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

	const animNames = style.animationName?.split(",").map((s) => s.trim()).filter(Boolean);
	const dursRaw = style.animationDuration;
	const delsRaw = style.animationDelay;

	/**
	 * Con catene `animationName` multipla, sostituire **ogni** delay con `1ms` fa partire
	 * quasi tutti i segmenti insieme → `animationend` / `onEnd` del segmento 2+ sembrano immediati.
	 * Ricostruiamo una micro-timeline sequenziale (1ms a segmento, delay cumulativo).
	 */
	if (animNames && animNames.length > 1 && dursRaw && delsRaw) {
		const durs = parseCssTimeListMs(dursRaw);
		const dels = parseCssTimeListMs(delsRaw);
		if (
			durs &&
			dels &&
			durs.length === animNames.length &&
			dels.length === animNames.length
		) {
			let t = 0;
			const outDur: string[] = [];
			const outDel: string[] = [];
			for (let i = 0; i < animNames.length; i++) {
				outDur.push("1ms");
				outDel.push(`${t}ms`);
				t += 1;
			}
			style.animationDuration = outDur.join(", ");
			style.animationDelay = outDel.join(", ");
			const a = style.animation;
			if (a) style.animation = a.replace(/\d+ms/g, "1ms");
			return;
		}
	}

	const a = style.animation;
	if (a) style.animation = a.replace(/\d+ms/g, "1ms");
	if (dursRaw) style.animationDuration = dursRaw.replace(/\d+ms/g, "1ms");
	if (delsRaw) style.animationDelay = delsRaw.replace(/\d+ms/g, "1ms");
}

/** In `animate: [{ …, onStart, onEnd }]` non sono getter reattivi: non vanno invocati in unwrap. */
const STYLE_ANIMATE_HOOK_KEYS = new Set(["onStart", "onEnd"]);

function clearS(el: El): void {
	clearAnimationLifecycle(el);
	teardownOverlays(el);
	if (el instanceof HTMLElement) {
		clearMediaBlend(el);
		clearVideoEdgeFade(el);
	}
	clearMapStyles(el);
	/** Preserve user classes; remove only those last applied by `s`. */
	const prevStyle = managedStyleClasses.get(el) ?? "";
	if (prevStyle) {
		const current = el.getAttribute("class") ?? "";
		const user = subtractClassString(current, prevStyle);
		if (user) el.setAttribute("class", user);
		else el.removeAttribute("class");
		managedStyleClasses.delete(el);
	} else {
		// legacy behavior: do nothing (don't clobber user classes)
	}
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
			if (STYLE_ANIMATE_HOOK_KEYS.has(k) && typeof val === "function" && !isSignal(val)) {
				out[k] = val;
				continue;
			}
			out[k] = unwrapStyleReactive(val);
		}
		return out;
	}
	return v;
}

function applyFromResolved(el: El, resolved: ResolvedStyle): void {
	const style = { ...resolved.style };
	const rmBefore =
		typeof window !== "undefined" && typeof window.matchMedia === "function"
			? window.matchMedia("(prefers-reduced-motion: reduce)").matches
			: false;
	applyReducedMotion(style);
	const rmAfter = rmBefore;

	fwLifecycleDebugLog("applyFromResolved enter", {
		tag: el.tagName,
		hasAnimLife: Boolean(resolved.animationLifecycle?.length),
		animLifeCount: resolved.animationLifecycle?.length ?? 0,
		prefersReducedMotion: rmAfter,
		animationName: style.animationName,
		animationDuration: style.animationDuration,
		animationDelay: style.animationDelay,
	});

	if (resolved.layers) el.setAttribute("data-fw-layers", "");
	else el.removeAttribute("data-fw-layers");

	applyMapStyles(el, style as Properties);

	if (typeof window !== "undefined" && el.isConnected) {
		try {
			const cs = getComputedStyle(el);
			fwLifecycleDebugLog("applyFromResolved computed (post-map)", {
				animationName: cs.animationName,
				animationDuration: cs.animationDuration,
				animationDelay: cs.animationDelay,
			});
		} catch (e) {
			fwLifecycleDebugLog("applyFromResolved getComputedStyle failed", String(e));
		}
	}

	clearAnimationLifecycle(el);
	if (resolved.animationLifecycle?.length) {
		fwLifecycleDebugLog("applyFromResolved syncAnimationLifecycle", {
			bindings: resolved.animationLifecycle.map((b) => ({
				name: b.name.slice(0, 48) + (b.name.length > 48 ? "…" : ""),
				endAfterMs: b.endAfterMs,
				hasOnEnd: b.onEnd != null,
				hasOnStart: b.onStart != null,
			})),
		});
		syncAnimationLifecycle(el, resolved.animationLifecycle);
	} else {
		fwLifecycleDebugLog("applyFromResolved no animationLifecycle (skip sync)");
	}

	const styleCls = resolved.classes.filter(Boolean).join(" ");
	const cls = mergeUserAndStyleClasses(el, styleCls);
	if (cls) el.setAttribute("class", cls);
	else el.removeAttribute("class");

	if (el instanceof HTMLElement) {
		flushMediaBlendAfterStyle(el);
		flushVideoEdgeFadeAfterStyle(el);
	}

	attachOverlays(el, resolved);
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
