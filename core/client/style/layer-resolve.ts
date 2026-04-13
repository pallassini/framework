import type { Properties } from "csstype";
import {
	buildAnimation,
	buildTransition,
	ensureAnimationCss,
	injectRule,
	type AnimateConfig,
	type AnimatePreset,
	type TransitionConfig,
} from "./animation";
import type { StyleGroup } from "./properties";
import { map } from "./properties";
import { parseStyleToken, resolveClasses, resolveToken } from "./resolve";
import type { StyleViewport } from "./viewport";

// ─── Tipi `s` ───────────────────────────────────────────────────────────────

export type Conditional<T> = T | readonly [T, boolean] | { value: T; when?: boolean };

export type AnimateInput = AnimatePreset | AnimateConfig | Array<AnimatePreset | AnimateConfig>;

export interface StyleLayerInput {
	base?: string | StyleLayerInput;
	mob?: string | StyleLayerInput;
	tab?: string | StyleLayerInput;
	des?: string | StyleLayerInput;
	class?: string;
	animate?: Conditional<AnimateInput>;
	transition?: Conditional<string | TransitionConfig>;
	[key: string]: unknown;
}

export type StyleInput = string | number | StyleLayerInput;

export type ResolvedStyle = {
	style: Record<string, string>;
	classes: string[];
	layers: boolean;
};

export const VIEWPORT_KEYS: StyleViewport[] = ["mob", "tab", "des"];

export const RESERVED_LAYER_KEYS = new Set([
	"base",
	"mob",
	"tab",
	"des",
	"class",
	"animate",
	"transition",
]);

// ─── Helpers ────────────────────────────────────────────────────────────────

function isStyleGroupEntry(v: unknown): v is StyleGroup {
	return typeof v === "object" && v !== null && "default" in v;
}

function stringifySuffix(val: unknown): string {
	if (typeof val === "number") return String(val);
	return String(val ?? "");
}

/** Basi per varianti `resolveToken`: chiavi con valore `true` e entry “flag” (oggetto senza `default`, non resolver). */
function collectBases(layer: StyleLayerInput): ReadonlySet<string> {
	const bases = new Set<string>();
	for (const [key, raw] of Object.entries(layer)) {
		if (RESERVED_LAYER_KEYS.has(key) || VIEWPORT_KEYS.includes(key as StyleViewport)) continue;
		if (unwrapConditional(raw) !== true) continue;
		const e = (map as Record<string, unknown>)[key];
		if (e == null || typeof e === "function" || isStyleGroupEntry(e)) continue;
		bases.add(key);
	}
	return bases;
}

export function unwrapConditional<T>(v: unknown): T | undefined {
	if (v == null || v === false) return undefined;
	if (Array.isArray(v) && v.length === 2) {
		const [a, cond] = v;
		if (cond === false) return undefined;
		return a as T;
	}
	if (typeof v === "object" && v !== null && "value" in v) {
		const o = v as { value: T; when?: boolean };
		if (o.when === false) return undefined;
		return o.value;
	}
	return v as T;
}

function emptyResolved(): ResolvedStyle {
	return { style: {}, classes: [], layers: false };
}

function mergeInto(target: ResolvedStyle, source: ResolvedStyle): void {
	Object.assign(target.style, source.style);
	target.classes.push(...source.classes);
	target.layers = target.layers || source.layers;
}

function propsToStrings(p: Properties): Record<string, string> {
	const out: Record<string, string> = {};
	for (const [k, v] of Object.entries(p)) {
		if (v == null || v === false || v === "") continue;
		out[k] = String(v);
	}
	return out;
}

/** Solo chiavi presenti in `map` (properties): resolver, StyleGroup o oggetto statico. */
function applyLayerMapKeys(layer: StyleLayerInput, target: Properties): void {
	const bases = collectBases(layer);

	for (const [key, raw] of Object.entries(layer)) {
		if (RESERVED_LAYER_KEYS.has(key) || VIEWPORT_KEYS.includes(key as StyleViewport)) continue;
		const v = unwrapConditional<unknown>(raw);
		if (v === undefined) continue;
		const entry = (map as Record<string, unknown>)[key];
		if (entry == null) continue;

		if (typeof entry === "object" && entry !== null && !isStyleGroupEntry(entry)) {
			if (v === true) Object.assign(target, entry as Properties);
		}
	}

	for (const [key, raw] of Object.entries(layer)) {
		if (RESERVED_LAYER_KEYS.has(key) || VIEWPORT_KEYS.includes(key as StyleViewport)) continue;
		const v = unwrapConditional<unknown>(raw);
		if (v === undefined) continue;
		const entry = (map as Record<string, unknown>)[key];
		if (entry == null) continue;

		if (typeof entry === "function") {
			Object.assign(target, resolveToken(map, key, stringifySuffix(v), bases));
			continue;
		}
		if (isStyleGroupEntry(entry)) {
			if (v === true) Object.assign(target, resolveToken(map, key, "", bases));
			else if (typeof v === "string" || typeof v === "number") {
				Object.assign(target, resolveToken(map, key, stringifySuffix(v), bases));
			}
		}
	}
}

// ─── Stringa token ───────────────────────────────────────────────────────────

/** Token con spazi; blocchi `mob:(...)` bilanciati sulle parentesi. */
export function tokenizeStyleString(input: string): string[] {
	const s = input.trim();
	const out: string[] = [];
	let i = 0;
	while (i < s.length) {
		while (i < s.length && /\s/.test(s[i]!)) i++;
		if (i >= s.length) break;
		const slice = s.slice(i);
		const m = slice.match(/^(mob|tab|des):/);
		if (m) {
			const openIdx = i + m[0]!.length;
			if (s[openIdx] !== "(") {
				let j = i;
				while (j < s.length && !/\s/.test(s[j]!)) j++;
				out.push(s.slice(i, j));
				i = j;
				continue;
			}
			let depth = 1;
			let j = openIdx + 1;
			while (j < s.length && depth > 0) {
				const ch = s[j]!;
				if (ch === "(") depth++;
				else if (ch === ")") depth--;
				j++;
			}
			out.push(s.slice(i, j));
			i = j;
		} else {
			let j = i;
			while (j < s.length && !/\s/.test(s[j]!)) j++;
			out.push(s.slice(i, j));
			i = j;
		}
	}
	return out;
}

export function activeTokensFromString(str: string, vp: StyleViewport): string {
	const parts: string[] = [];
	for (const t of tokenizeStyleString(str)) {
		const m = t.match(/^(mob|tab|des):\(([\s\S]*)\)$/);
		if (m) {
			if (m[1] === vp) parts.push(m[2]!.trim());
			continue;
		}
		parts.push(t);
	}
	return parts.join(" ");
}

function hasLayersInActive(active: string): boolean {
	const tokens = active.trim().split(/\s+/).filter(Boolean);
	return tokens.some((t) => parseStyleToken(t).base === "layers");
}

export function resolveStyleString(str: string, vp: StyleViewport): ResolvedStyle {
	const result = emptyResolved();
	const active = activeTokensFromString(str, vp);
	if (!active.trim()) return result;

	const tokens = active.trim().split(/\s+/).filter(Boolean);
	const known: string[] = [];
	const passthrough: string[] = [];
	for (const t of tokens) {
		if (parseStyleToken(t).base in map) known.push(t);
		else passthrough.push(t);
	}

	if (known.length) {
		const props = resolveClasses(map, known.join(" "));
		Object.assign(result.style, propsToStrings(props));
	}
	result.classes = passthrough;
	result.layers = hasLayersInActive(active);
	return result;
}

function mergeAnimate(anim: AnimateInput | undefined, into: ResolvedStyle): void {
	if (anim == null) return;
	ensureAnimationCss();
	const built = buildAnimation(anim);
	if (built.class) into.classes.push(...built.class.split(/\s+/).filter(Boolean));
	if (built.style) Object.assign(into.style, built.style);
	if (built.keyframesCss && built.id) {
		injectRule("fw-kf", built.keyframesCss);
	}
}

export function resolveStyleLayer(layer: StyleLayerInput, vp: StyleViewport): ResolvedStyle {
	const result = emptyResolved();

	if (layer.base != null) {
		const base =
			typeof layer.base === "string"
				? resolveStyleString(layer.base, vp)
				: resolveStyleLayer(layer.base, vp);
		mergeInto(result, base);
	}

	const fromMap: Properties = {};
	applyLayerMapKeys(layer, fromMap);
	Object.assign(result.style, propsToStrings(fromMap));

	const vpRaw = layer[vp];
	if (vpRaw != null) {
		const sub =
			typeof vpRaw === "string" ? resolveStyleString(vpRaw, vp) : resolveStyleLayer(vpRaw as StyleLayerInput, vp);
		mergeInto(result, sub);
	}

	const cls = unwrapConditional<string>(layer.class);
	if (cls) result.classes.push(...cls.trim().split(/\s+/).filter(Boolean));

	const tr = unwrapConditional(layer.transition);
	if (tr != null) {
		result.style.transition = buildTransition(tr as string | TransitionConfig);
	}

	const anim = unwrapConditional<AnimateInput>(layer.animate);
	mergeAnimate(anim, result);

	return result;
}

export function resolveStyleInput(input: StyleInput, vp: StyleViewport): ResolvedStyle {
	if (typeof input === "number") return resolveStyleString(String(input), vp);
	if (typeof input === "string") return resolveStyleString(input, vp);
	return resolveStyleLayer(input as StyleLayerInput, vp);
}
