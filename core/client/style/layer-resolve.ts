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
import {
	applyPositionedInsetDefaultsResolved,
	parseStyleToken,
	resolveClasses,
	resolveToken,
} from "./resolve";
import { isSignal, type Signal } from "../state/state/signal";
import { isStyleEqDescriptor } from "./styleEq";
import type { StyleViewport } from "./viewport";
import { tokenizeStyleString } from "./tokenize-style";

// ─── Tipi `s` ───────────────────────────────────────────────────────────────

/** `when` può essere valutato prima del resolve da `unwrapStyleReactive` se è `() => boolean`. */
export type Conditional<T> =
	| T
	| readonly [T, boolean | (() => boolean)]
	| readonly [() => boolean, T]
	| { value: T; when?: boolean };

export type AnimateInput = AnimatePreset | AnimateConfig | Array<AnimatePreset | AnimateConfig>;

/**
 * Elemento di `base` quando è un array: stringa; `Conditional<string>`; oppure **mappa token → condizione**
 * (`{ "bg-#fff": [persistState.foo, "x"] }` → include `"bg-#fff"` quando `persistState.foo() === "x"`).
 */
export type StyleBaseSegment = string | Conditional<string> | Readonly<Record<string, unknown>>;

/**
 * Oggetto `s` (oltre alla stringa pura):
 * - **base** — stringa, layer annidato, **oggetto** mappa (`{ __: "token fissi", "…": [Signal, rhs] }` o `: true`), oppure **array** di segmenti; merge in ordine.
 * - **Chiavi del map** (`bg`, `px`, …): suffisso statico; oppure **`[suffisso, () => boolean]`** / **`Signal`**;
 *   oppure **`[() => boolean, suffisso]`** (condizione reattiva prima, valore dopo — niente `===` nella chiave).
 *   Merge dopo `base`, sovrascrive le stesse proprietà CSS.
 * - **mob** / **tab** / **des** — token o layer per quel viewport.
 */
export interface StyleLayerInput {
	base?: string | StyleLayerInput | readonly StyleBaseSegment[] | Readonly<Record<string, unknown>>;
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

function mergeBaseSets(ancestor: ReadonlySet<string> | undefined, own: ReadonlySet<string>): Set<string> {
	const out = new Set<string>();
	if (ancestor) for (const b of ancestor) out.add(b);
	for (const b of own) out.add(b);
	return out;
}

/**
 * Token base (`col`, `row`, …) già presenti nel `base` del layer: servono a `resolveToken` per le varianti
 * quando `mob`/`tab`/`des` è una stringa separata (altrimenti `centerX` non vede `col` e usa solo `default`).
 */
function collectBasesFromStyleBase(base: StyleLayerInput["base"], vp: StyleViewport): Set<string> {
	const out = new Set<string>();
	if (base == null) return out;
	if (typeof base === "string") {
		const active = activeTokensFromString(base, vp);
		for (const t of tokenizeStyleString(active)) out.add(parseStyleToken(t).base);
		return out;
	}
	if (Array.isArray(base)) {
		for (const item of base) {
			if (item == null || item === false) continue;
			const u = unwrapConditional<string>(item);
			if (u === undefined) continue;
			const active = activeTokensFromString(u, vp);
			for (const t of tokenizeStyleString(active)) out.add(parseStyleToken(t).base);
		}
		return out;
	}
	const condensed = condenseConditionalTokenMap(base as Record<string, unknown>);
	if (condensed !== null) {
		if (condensed !== undefined) {
			const active = activeTokensFromString(condensed, vp);
			for (const t of tokenizeStyleString(active)) out.add(parseStyleToken(t).base);
		}
		return out;
	}
	return collectBasesFromStyleBase((base as StyleLayerInput).base, vp);
}

/** Chiave riservata in una mappa token→condizione: token stringa sempre inclusi (equivalente a `: true` su ogni token). */
export const STYLE_BASE_ALWAYS_KEY = "__";

/**
 * Mappa token → condizione (stessa forma di `unwrapStyleReactive` in `style/index.ts`).
 * - Chiave **`__`**: valore = stringa di token sempre attivi (niente `: true` su ogni classe).
 * - Altre chiavi: token inclusi se condizione vera; **`[Signal, rhs]`** o **`styleEq(signal, rhs)`** (stesso significato, senza `() =>`); oppure **`() => boolean`**.
 * `readRhs` valuta rhs e valori di `__` se annidati reattivi.
 */
export function condenseConditionalTokenMap(
	o: Record<string, unknown>,
	readRhs?: (v: unknown) => unknown,
): string | undefined | null {
	const keys = Object.keys(o);
	if (keys.length === 0) return null;
	for (const k of keys) {
		if (k === STYLE_BASE_ALWAYS_KEY) continue;
		if (RESERVED_LAYER_KEYS.has(k) || VIEWPORT_KEYS.includes(k as StyleViewport)) return null;
	}
	const read = readRhs ?? ((v: unknown) => v);
	const prefix: string[] = [];
	const condKeys: string[] = [];

	if (STYLE_BASE_ALWAYS_KEY in o) {
		const raw = o[STYLE_BASE_ALWAYS_KEY];
		if (raw != null && typeof raw === "object" && !Array.isArray(raw)) return null;
		const s = String(read(raw)).trim();
		if (s) prefix.push(...s.split(/\s+/).filter(Boolean));
	}

	for (const [k, val] of Object.entries(o)) {
		if (k === STYLE_BASE_ALWAYS_KEY) continue;

		let on = false;
		if (isStyleEqDescriptor(val)) {
			const right = read(val.rhs);
			on = Object.is(val.signal(), right);
		} else if (val != null && typeof val === "object" && !Array.isArray(val)) return null;
		else if (Array.isArray(val) && val.length === 2 && isSignal(val[0])) {
			const right = read(val[1]);
			on = Object.is((val[0] as Signal<unknown>)(), right);
		} else if (Array.isArray(val)) {
			return null;
		} else if (val === true) on = true;
		else if (val === false || val == null) on = false;
		else if (typeof val === "function") on = !!(val as () => unknown)();
		else return null;

		if (on) condKeys.push(k);
	}

	const out = [...prefix, ...condKeys].join(" ");
	if (!out) return undefined;
	return out;
}

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
		if (typeof cond === "function" && !(cond as () => boolean)()) return undefined;
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
	return tokenizeStyleString(active).some((t) => parseStyleToken(t).base === "layers");
}

export function resolveStyleString(
	str: string,
	vp: StyleViewport,
	extraBasesForVariants?: ReadonlySet<string>,
): ResolvedStyle {
	const result = emptyResolved();
	const active = activeTokensFromString(str, vp);
	if (!active.trim()) return result;

	const tokens = tokenizeStyleString(active);
	const known: string[] = [];
	const passthrough: string[] = [];
	for (const t of tokens) {
		if (parseStyleToken(t).base in map) known.push(t);
		else passthrough.push(t);
	}

	if (known.length) {
		const props = resolveClasses(map, known.join(" "), extraBasesForVariants);
		Object.assign(result.style, propsToStrings(props));
	}
	result.classes = passthrough;
	result.layers = hasLayersInActive(active);
	applyPositionedInsetDefaultsResolved(result.style);
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

export function resolveStyleLayer(
	layer: StyleLayerInput,
	vp: StyleViewport,
	/** Basi ereditate da un layer padre (viewport annidato). */
	ancestorBases?: ReadonlySet<string>,
): ResolvedStyle {
	const result = emptyResolved();
	const contextForVp = mergeBaseSets(ancestorBases, collectBasesFromStyleBase(layer.base, vp));

	if (layer.base != null) {
		const b = layer.base;
		if (typeof b === "string") {
			mergeInto(result, resolveStyleString(b, vp));
		} else if (Array.isArray(b)) {
			for (const item of b) {
				if (item == null || item === false) continue;
				const u = unwrapConditional<string>(item);
				if (u === undefined) continue;
				mergeInto(result, resolveStyleString(u, vp));
			}
		} else {
			const condensed = condenseConditionalTokenMap(b as Record<string, unknown>);
			if (condensed !== null) {
				if (condensed !== undefined) mergeInto(result, resolveStyleString(condensed, vp));
			} else {
				mergeInto(result, resolveStyleLayer(b as StyleLayerInput, vp, ancestorBases));
			}
		}
	}

	const fromMap: Properties = {};
	applyLayerMapKeys(layer, fromMap);
	Object.assign(result.style, propsToStrings(fromMap));

	const vpRaw = layer[vp];
	if (vpRaw != null) {
		const sub =
			typeof vpRaw === "string"
				? resolveStyleString(vpRaw, vp, contextForVp)
				: resolveStyleLayer(vpRaw as StyleLayerInput, vp, contextForVp);
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

	applyPositionedInsetDefaultsResolved(result.style);
	return result;
}

export function resolveStyleInput(input: StyleInput, vp: StyleViewport): ResolvedStyle {
	if (typeof input === "number") return resolveStyleString(String(input), vp);
	if (typeof input === "string") return resolveStyleString(input, vp);
	return resolveStyleLayer(input as StyleLayerInput, vp);
}
