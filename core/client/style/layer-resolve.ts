import type { Properties } from "csstype";
import {
	animationLayerEndAfterMs,
	buildAnimation,
	buildTransition,
	ensureAnimationCss,
	fwAnimateDebugLog,
	injectRule,
	type AnimateConfig,
	type AnimationLifecycleBinding,
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
 * - **base** — stringa, layer annidato, **oggetto** mappa (`{ __: "…", __after: "…", "…": [Signal, rhs] }` o `: true`), oppure **array** di segmenti; `__` prima delle chiavi `: true`, `__after` dopo (override); merge in ordine.
 * - **Chiavi del map** (`bg`, `px`, …): suffisso statico; oppure **`[suffisso, () => boolean]`** / **`Signal`**;
 *   oppure **`[() => boolean, suffisso]`** (condizione reattiva prima, valore dopo — niente `===` nella chiave).
 *   Merge dopo `base`, sovrascrive le stesse proprietà CSS.
 * - **mob** / **tab** / **des** — stringa di token **oppure** lo stesso tipo di oggetto del layer (`base`, `class`, `animate`, `transition`, chiavi map, …) **senza** annidare di nuovo `mob`/`tab`/`des` nello stesso ramo. Se il ramo viewport ha un **`animate`** proprio, **non** si applica più l’`animate` del livello esterno (solo quello del ramo).
 * - **animate** — preset, oggetto, oppure **array** in sequenza: ogni elemento usa **`to`** (e opz. `track`) come overlay sullo stato corrente; `base` resta il fondo sempre sovrascrivibile. Con **array**, il runtime aggiunge in coda layer no-op (keyframes vuoti) se servono per avere **almeno 3** voci nelle proprietà `animation*` (workaround motori che con sole 2 animazioni non rispettano la catena). Non servono blocchi `{ to: "", duration: 0 }` manuali. Ogni segmento può avere **`delay`** in ms (oltre al ritardo cumulativo della catena), **`onStart`** su `animationstart`, **`onEnd`** dopo **`delay + duration×iterazioni`** (timer dalla timeline; con `prefers-reduced-motion: reduce` si usa `animationend`). Un blocco con **`to` vuoto** e **`duration` > 0** è un hold sullo stato corrente.
 */
export interface StyleLayerInput {
	base?: string | StyleLayerInput | readonly StyleBaseSegment[] | Readonly<Record<string, unknown>>;
	mob?: string | StyleLayerInput;
	tab?: string | StyleLayerInput;
	des?: string | StyleLayerInput;
	/** Overlay al passaggio del mouse (applicato solo se non viewport `mob`). */
	hover?: string | StyleLayerInput;
	/** Stile come `hover`, ma con focus reale sull’elemento o un discendente (`focusin` / `focusout` come `:focus-within`). */
	focus?: string | StyleLayerInput;
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
	/** Callback legati ai nomi `@keyframes` applicati (vedi `syncAnimationLifecycle`). */
	animationLifecycle?: ReadonlyArray<AnimationLifecycleBinding>;
	/** Stile overlay da `hover` nel layer (merge al mouse; solo se non mob). */
	hover?: ResolvedStyle;
	/** Stile overlay da `focus:(…)` o `focus` oggetto (merge a focus reale, come `:focus-within`). */
	focus?: ResolvedStyle;
};

export const VIEWPORT_KEYS: StyleViewport[] = ["mob", "tab", "des"];

export const RESERVED_LAYER_KEYS = new Set([
	"base",
	"mob",
	"tab",
	"des",
	"hover",
	"focus",
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
 * Token stringa applicati **dopo** tutte le chiavi con `: true` (ultimo vince in `resolveClasses`).
 * Usato da `recombineStringSpreadInTokenMap` così `{ "…bg-secondary": true, ...s }` con `s` stringa può sovrascrivere `bg-*`.
 */
export const STYLE_BASE_SUFFIX_KEY = "__after";

/**
 * `{ ...str }` su una stringa in oggetto mappa produce chiavi `"0"`,`"1"`,… con un carattere per valore.
 * Ricompone la stringa in `__after`, così `{ "a": true, ...s }` con `s` stringa funziona e gli override vincono sui default.
 */
export function recombineStringSpreadInTokenMap(
	o: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
	const indexed: { i: number; ch: string }[] = [];
	for (const [k, v] of Object.entries(o)) {
		if (!/^\d+$/.test(k)) continue;
		if (typeof v !== "string" || v.length !== 1) {
			return { ...(o as Record<string, unknown>) };
		}
		indexed.push({ i: Number(k), ch: v });
	}
	if (indexed.length === 0) return o as Record<string, unknown>;

	indexed.sort((a, b) => a.i - b.i);
	for (let j = 0; j < indexed.length; j++) {
		if (indexed[j]!.i !== j) return { ...(o as Record<string, unknown>) };
	}

	const reconstructed = indexed.map((x) => x.ch).join("");
	const rest: Record<string, unknown> = { ...(o as Record<string, unknown>) };
	for (let j = 0; j < indexed.length; j++) {
		delete rest[String(j)];
	}

	const prev = rest[STYLE_BASE_ALWAYS_KEY];
	if (prev != null && typeof prev === "object" && !Array.isArray(prev)) {
		return { ...(o as Record<string, unknown>) };
	}
	if (reconstructed) {
		const ex = rest[STYLE_BASE_SUFFIX_KEY];
		const prevSuf = ex == null ? "" : String(ex).trim();
		const merged = [prevSuf, reconstructed].filter(Boolean).join(" ").trim();
		if (merged) rest[STYLE_BASE_SUFFIX_KEY] = merged;
	}
	return rest;
}

/**
 * Mappa token → condizione (stessa forma di `unwrapStyleReactive` in `style/index.ts`).
 * - Chiave **`__`**: valore = stringa di token sempre attivi (niente `: true` su ogni classe); ordine **prima** delle chiavi `: true`.
 * - Chiave **`__after`**: come `__` ma **dopo** le chiavi `: true` (override / spread stringa ricomposto).
 * - Altre chiavi: token inclusi se condizione vera; **`[Signal, rhs]`** o **`styleEq(signal, rhs)`** (stesso significato, senza `() =>`); oppure **`() => boolean`**.
 * `readRhs` valuta rhs e valori di `__` / `__after` se annidati reattivi.
 */
export function condenseConditionalTokenMap(
	o: Record<string, unknown>,
	readRhs?: (v: unknown) => unknown,
): string | undefined | null {
	o = recombineStringSpreadInTokenMap(o);
	const keys = Object.keys(o);
	if (keys.length === 0) return null;
	for (const k of keys) {
		if (k === STYLE_BASE_ALWAYS_KEY || k === STYLE_BASE_SUFFIX_KEY) continue;
		if (RESERVED_LAYER_KEYS.has(k) || VIEWPORT_KEYS.includes(k as StyleViewport)) return null;
	}
	const read = readRhs ?? ((v: unknown) => v);
	const prefix: string[] = [];
	const condKeys: string[] = [];
	const suffix: string[] = [];

	if (STYLE_BASE_ALWAYS_KEY in o) {
		const raw = o[STYLE_BASE_ALWAYS_KEY];
		if (raw != null && typeof raw === "object" && !Array.isArray(raw)) return null;
		const s = String(read(raw)).trim();
		if (s) prefix.push(...s.split(/\s+/).filter(Boolean));
	}

	if (STYLE_BASE_SUFFIX_KEY in o) {
		const raw = o[STYLE_BASE_SUFFIX_KEY];
		if (raw != null && typeof raw === "object" && !Array.isArray(raw)) return null;
		const s = String(read(raw)).trim();
		if (s) suffix.push(...s.split(/\s+/).filter(Boolean));
	}

	for (const [k, val] of Object.entries(o)) {
		if (k === STYLE_BASE_ALWAYS_KEY || k === STYLE_BASE_SUFFIX_KEY) continue;

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

	const out = [...prefix, ...condKeys, ...suffix].join(" ");
	if (!out) return undefined;
	return out;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Due oggetti nella forma di segmento `animate` (non tupla `Conditional`). */
function looksLikeAnimateSegment(x: unknown): boolean {
	if (x == null || typeof x !== "object" || Array.isArray(x)) return false;
	const o = x as Record<string, unknown>;
	return (
		"to" in o ||
		"preset" in o ||
		"track" in o ||
		"keyframes" in o ||
		"duration" in o ||
		"opacity" in o ||
		"scale" in o ||
		"scaleX" in o ||
		"scaleY" in o ||
		"x" in o ||
		"y" in o ||
		"delay" in o ||
		"ease" in o ||
		"fill" in o ||
		"blur" in o ||
		"rotate" in o
	);
}

function isTwoItemAnimateChain(a: unknown, b: unknown): boolean {
	return looksLikeAnimateSegment(a) && looksLikeAnimateSegment(b);
}

/** Il ramo `mob`/`tab`/`des` è un oggetto con `animate` effettivo → sostituisce l’`animate` del parent. */
function viewportBranchDeclaresAnimate(vpRaw: unknown): boolean {
	if (vpRaw == null || typeof vpRaw !== "object" || Array.isArray(vpRaw)) return false;
	return unwrapConditional<AnimateInput>((vpRaw as StyleLayerInput).animate) != null;
}

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
		/**
		 * `animate: [ { to, duration }, { to, duration } ]` ha lunghezza 2 ma **non** è
		 * `Conditional` `[segmento, boolean|fn]` — prima si prendeva solo il primo elemento.
		 */
		if (isTwoItemAnimateChain(a, cond)) {
			return v as T;
		}
		if (cond === false) return undefined;
		if (typeof cond === "function" && !(cond as () => boolean)()) return undefined;
		if (typeof cond === "boolean" || typeof cond === "function") {
			return a as T;
		}
		return v as T;
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
	if (source.animationLifecycle?.length) {
		target.animationLifecycle = [...(target.animationLifecycle ?? []), ...source.animationLifecycle];
	}
	if (source.hover) {
		target.hover = source.hover;
	}
	if (source.focus) {
		target.focus = source.focus;
	}
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
	const tokens = tokenizeStyleString(str);
	/** Allineato a `resolveStyleLayer`: su `tab`, se esiste `tab:(…)` vince su `des:(…)`; altrimenti `des` fa da fallback. */
	let hasTabBlock = false;
	if (vp === "tab") {
		for (const t of tokens) {
			const m = t.match(/^(mob|tab|des):\(([\s\S]*)\)$/);
			if (m?.[1] === "tab") {
				hasTabBlock = true;
				break;
			}
		}
	}

	const parts: string[] = [];
	for (const t of tokens) {
		const m = t.match(/^(mob|tab|des):\(([\s\S]*)\)$/);
		if (m) {
			const branch = m[1] as StyleViewport;
			const inner = m[2]!.trim();
			if (branch === vp) parts.push(inner);
			else if (vp === "tab" && branch === "des" && !hasTabBlock) parts.push(inner);
			continue;
		}
		parts.push(t);
	}
	return parts.join(" ");
}

function hasLayersInActive(active: string): boolean {
	return tokenizeStyleString(active).some((t) => parseStyleToken(t).base === "layers");
}

const HOVER_PREFIX = "hover:(";
const FOCUS_PREFIX = "focus:(";

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
	const hoverInners: string[] = [];
	const focusInners: string[] = [];
	for (const t of tokens) {
		if (/^hover:\(/i.test(t) && t.endsWith(")")) {
			hoverInners.push(t.slice(HOVER_PREFIX.length, -1).trim());
			continue;
		}
		if (/^focus:\(/i.test(t) && t.endsWith(")")) {
			focusInners.push(t.slice(FOCUS_PREFIX.length, -1).trim());
			continue;
		}
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

	if (hoverInners.length) {
		const mergedHover = hoverInners.join(" ");
		const hoverResolved = resolveStyleString(mergedHover, vp, extraBasesForVariants);
		result.hover = hoverResolved;
	}
	if (focusInners.length) {
		const mergedFocus = focusInners.join(" ");
		const focusResolved = resolveStyleString(mergedFocus, vp, extraBasesForVariants);
		result.focus = focusResolved;
	}
	return result;
}

function styleSnapshotForKeyframes(style: Record<string, string>): Record<string, string> {
	const o: Record<string, string> = {};
	for (const [k, v] of Object.entries(style)) {
		if (k === "animation" || k.startsWith("animation")) continue;
		o[k] = v;
	}
	return o;
}

function mergeAnimate(
	anim: AnimateInput | undefined,
	into: ResolvedStyle,
	vp: StyleViewport,
	extraBases: ReadonlySet<string>,
): void {
	if (anim == null) return;
	ensureAnimationCss();
	const snap = styleSnapshotForKeyframes(into.style);
	fwAnimateDebugLog("mergeAnimate apply", {
		vp,
		isArray: Array.isArray(anim),
		arrayLength: Array.isArray(anim) ? anim.length : undefined,
		snapshotKeys: Object.keys(snap),
		snapshotSample: Object.fromEntries(Object.entries(snap).slice(0, 10)),
	});
	const built = buildAnimation(anim, {
		keyframeStartAcc: snap,
		resolveTokens: (tokenString: string) => {
			const r = resolveStyleString(tokenString.trim(), vp, extraBases);
			return { ...r.style };
		},
	});
	if (built.class) into.classes.push(...built.class.split(/\s+/).filter(Boolean));
	if (built.style) Object.assign(into.style, built.style);
	if (built.keyframesCss) {
		const chunks = built.keyframesCss
			.split(/(?=@keyframes)/g)
			.map((s) => s.trim())
			.filter(Boolean);
		fwAnimateDebugLog("mergeAnimate inject keyframes", {
			chunks: chunks.length,
			totalChars: built.keyframesCss.length,
			firstChunkPreview: chunks[0]?.slice(0, 120),
		});
		for (const chunk of chunks) {
			injectRule("fw-kf", chunk);
		}
	} else {
		fwAnimateDebugLog("mergeAnimate no keyframesCss", {
			hasClass: Boolean(built.class),
			hasStyle: Boolean(built.style),
			layers: built.layers?.length ?? 0,
		});
	}
	fwAnimateDebugLog("mergeAnimate into.style animation props", {
		animation: into.style.animation,
		animationName: into.style.animationName,
		animationDuration: into.style.animationDuration,
		animationDelay: into.style.animationDelay,
		animationTimingFunction: into.style.animationTimingFunction,
		animationFillMode: into.style.animationFillMode,
	});

	if (built.layers?.length) {
		const life: AnimationLifecycleBinding[] = built.layers
			.filter((l) => l.onStart != null || l.onEnd != null)
			.map((l) => {
				const endAfterMs = animationLayerEndAfterMs(l);
				return {
					name: l.name,
					onStart: l.onStart,
					onEnd: l.onEnd,
					...(endAfterMs !== undefined ? { endAfterMs } : {}),
				};
			});
		if (life.length) {
			fwAnimateDebugLog("mergeAnimate lifecycle bindings", {
				count: life.length,
				items: life.map((b) => ({
					name: b.name.length > 48 ? `${b.name.slice(0, 48)}…` : b.name,
					endAfterMs: b.endAfterMs,
					hasOnEnd: b.onEnd != null,
					hasOnStart: b.onStart != null,
				})),
			});
			into.animationLifecycle = [...(into.animationLifecycle ?? []), ...life];
		}
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
				mergeInto(
					result,
					resolveStyleLayer(
						recombineStringSpreadInTokenMap(b as Record<string, unknown>) as StyleLayerInput,
						vp,
						ancestorBases,
					),
				);
			}
		}
	}

	const fromMap: Properties = {};
	applyLayerMapKeys(layer, fromMap);
	Object.assign(result.style, propsToStrings(fromMap));

	/**
	 * Regola fallback viewport (dopo `base` che è sempre applicato):
	 * - `des` (scritto): applica a **des e tab** — tab eredita perché desktop-like.
	 * - `tab` (scritto): applica **solo a tab** (sovrascrive l'eventuale `des`).
	 * - `mob` (scritto): applica **solo a mob** (mobile richiede design proprio).
	 * Quindi:
	 *   - quando si risolve `des` → usa `layer.des`.
	 *   - quando si risolve `tab` → usa `layer.tab` se definito, altrimenti `layer.des`.
	 *   - quando si risolve `mob` → usa `layer.mob` (niente fallback).
	 */
	let vpRaw: unknown = null;
	if (vp === "des") {
		vpRaw = layer.des ?? null;
	} else if (vp === "tab") {
		vpRaw = layer.tab ?? layer.des ?? null;
	} else {
		vpRaw = layer.mob ?? null;
	}
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
	if (!viewportBranchDeclaresAnimate(vpRaw)) {
		mergeAnimate(anim, result, vp, contextForVp);
	}

	const hoverRaw = unwrapConditional(layer.hover);
	if (hoverRaw != null) {
		const hIn = hoverRaw as string | StyleLayerInput;
		const hoverResolved =
			typeof hIn === "string"
				? resolveStyleString(hIn, vp, contextForVp)
				: resolveStyleLayer(hIn as StyleLayerInput, vp, contextForVp);
		result.hover = hoverResolved;
	}

	const focusRaw = unwrapConditional(layer.focus);
	if (focusRaw != null) {
		const fIn = focusRaw as string | StyleLayerInput;
		const focusResolved =
			typeof fIn === "string"
				? resolveStyleString(fIn, vp, contextForVp)
				: resolveStyleLayer(fIn as StyleLayerInput, vp, contextForVp);
		result.focus = focusResolved;
	}

	applyPositionedInsetDefaultsResolved(result.style);
	return result;
}

export function resolveStyleInput(input: StyleInput, vp: StyleViewport): ResolvedStyle {
	if (typeof input === "number") return resolveStyleString(String(input), vp);
	if (typeof input === "string") return resolveStyleString(input, vp);
	return resolveStyleLayer(input as StyleLayerInput, vp);
}
