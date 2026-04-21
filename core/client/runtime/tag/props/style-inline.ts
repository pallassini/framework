import type { Properties } from "csstype";
import { watch } from "../../../state/effect";
import { isSignal, type Signal } from "../../../state/state";
import { onNodeDispose } from "../../logic/lifecycle";

type El = HTMLElement | SVGElement;

export type InlineStyleValue = Properties | null | undefined | false;

/**
 * Prop `style`: inline CSS (reattivo).
 * Accetta oggetto statico `{ width: "100px", transform: "scale(1.1)" }`, `Signal<StyleObj>`, funzione `() => StyleObj`.
 * Gestisce solo le chiavi dichiarate in questa prop: non confligge con `s` / `show` che scrivono su chiavi diverse.
 * Chiavi in camelCase o kebab-case (normalizzate in kebab-case).
 */
type Ctl = {
	stop: () => void;
	managedKeys: Set<string>;
	currentValue: unknown;
};

const styleInlineControllers = new WeakMap<El, Ctl>();

function camelToKebab(prop: string): string {
	if (prop.startsWith("--")) return prop;
	return prop.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase());
}

function normalizeKey(k: string): string {
	if (k.includes("-")) return k;
	return camelToKebab(k);
}

function readValue(v: unknown): InlineStyleValue {
	if (typeof v === "function") return (v as () => InlineStyleValue)();
	if (isSignal(v)) return (v as Signal<InlineStyleValue>)();
	return v as InlineStyleValue;
}

function applyStyleObject(el: El, next: InlineStyleValue, prevKeys: Set<string>): Set<string> {
	const nextKeys = new Set<string>();
	if (next && typeof next === "object") {
		for (const [k, v] of Object.entries(next)) {
			if (v == null || v === false || v === "") continue;
			const kebab = normalizeKey(k);
			el.style.setProperty(kebab, String(v));
			nextKeys.add(kebab);
		}
	}
	for (const k of prevKeys) {
		if (!nextKeys.has(k)) el.style.removeProperty(k);
	}
	return nextKeys;
}

function detach(el: El): void {
	const ctl = styleInlineControllers.get(el);
	if (!ctl) return;
	ctl.stop();
	for (const k of ctl.managedKeys) el.style.removeProperty(k);
	styleInlineControllers.delete(el);
}

export function style(el: El, v: unknown): void {
	const prev = styleInlineControllers.get(el);
	if (prev && prev.currentValue === v) return;

	if (prev) {
		prev.stop();
		for (const k of prev.managedKeys) el.style.removeProperty(k);
		styleInlineControllers.delete(el);
	}

	if (v == null || v === false) return;

	const ctl: Ctl = { stop: () => {}, managedKeys: new Set(), currentValue: v };
	styleInlineControllers.set(el, ctl);

	if (typeof v === "function" || isSignal(v)) {
		ctl.stop = watch(() => {
			const resolved = readValue(v);
			ctl.managedKeys = applyStyleObject(el, resolved, ctl.managedKeys);
		});
	} else {
		ctl.managedKeys = applyStyleObject(el, v as InlineStyleValue, ctl.managedKeys);
	}

	onNodeDispose(el, () => detach(el));
}
