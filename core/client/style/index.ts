export { map, styleMap, type StyleGroup, type StyleResolver, type StyleVariantKey } from "./properties";
export { resolveClasses, resolveToken, parseStyleToken } from "./resolve";

import type { Properties } from "csstype";
import { watch } from "../state/effect";
import { isSignal, type Signal } from "../state/state/signal";
import { onNodeDispose } from "../runtime/logic/lifecycle";
import { map } from "./properties";
import { resolveClasses, parseStyleToken } from "./resolve";

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

/** Token il cui `base` è nel `map` → risolti in `style`; gli altri restano su `class`. */
function applyResolvedTokens(el: El, classNames: string): void {
	const tokens = classNames.trim().split(/\s+/).filter(Boolean);
	const known: string[] = [];
	const passthrough: string[] = [];
	for (const t of tokens) {
		if (parseStyleToken(t).base in map) known.push(t);
		else passthrough.push(t);
	}

	if (known.length) {
		applyMapStyles(el, resolveClasses(map, known.join(" ")));
	} else {
		clearMapStyles(el);
	}

	const cls = passthrough.join(" ");
	if (cls) el.setAttribute("class", cls);
	else el.removeAttribute("class");
}

export function applyClass(el: El, v: unknown): void {
	if (v == null || v === false) return;

	if (typeof v === "string" || typeof v === "number") {
		applyResolvedTokens(el, String(v));
		return;
	}

	if (typeof v === "function") {
		const fn = v as () => unknown;
		const stop = watch(() => {
			const out = fn();
			if (out == null || out === false) {
				clearMapStyles(el);
				el.removeAttribute("class");
				return;
			}
			applyResolvedTokens(el, String(out));
		});
		onNodeDispose(el, () => {
			stop();
			clearMapStyles(el);
		});
		return;
	}

	if (isSignal(v)) {
		const sig = v as Signal<unknown>;
		const stop = watch(() => {
			const out = sig();
			if (out == null || out === false) {
				clearMapStyles(el);
				el.removeAttribute("class");
				return;
			}
			applyResolvedTokens(el, String(out));
		});
		onNodeDispose(el, () => {
			stop();
			clearMapStyles(el);
		});
	}
}
