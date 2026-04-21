import * as glyphs from "./icons";
import { applyDomProps } from "../../../logic/dom-props";
import { onNodeDispose } from "../../../logic/lifecycle";
import type { DomProps, SharedProps, UiNode } from "../../props";
import "../../../../style/client-config-style";
import { applyStyle } from "../../../../style";
import { activeTokensFromString, unwrapConditional, type StyleLayerInput } from "../../../../style/layer-resolve";
import { isStyleEqDescriptor } from "../../../../style/styleEq";
import { watch } from "../../../../state/effect";
import { isSignal, type Signal } from "../../../../state/state/signal";
import { CSS_LENGTH_RE, isCssVarToken } from "../../../../style/properties/utils/units";
import { parseStyleToken } from "../../../../style/resolve";
import { tokenizeStyleString } from "../../../../style/tokenize-style";
import { styleViewport } from "../../../../style/viewport";
import { resolveIconSizeFromScaleKey } from "./scale";

const customTemplates = new Map<string, SVGElement>();

export type Icon = keyof typeof glyphs;

/**
 * Props di `<icon>`.
 * Con `s` come **stringa**: `bg-*` / `p-*` / `round-*` sul contenitore; `text-*` / `font-*` / `shadow-*` sull’SVG (`shadow-*` → `dshadow-*`, glow sul glifo; potenza: `shadow-primary-40`, `shadow-primary-12px-a40`, … vedi `dshadow` in `properties`).
 */
/**
 * Glow sul solo disegno (non box-shadow rettangolare).
 * - Stringa: `"primary"` / `"secondary"` (default blur 2, intensity 3).
 * - Oggetto: `{ color?, blur?, intensity? }` — **blur** e **intensity** sono scale **1–5**.
 * `color` ammette `"primary"`, `"secondary"` o un CSS color (`#fff`, `rgb(...)`, `var(--x)`).
 */
export type IconShadowValue =
	| "primary"
	| "secondary"
	| {
			color?: "primary" | "secondary" | string;
			/** 1–5 → 4 / 8 / 14 / 22 / 32 px. */
			blur?: 1 | 2 | 3 | 4 | 5;
			/** 1–5 → 20 / 40 / 60 / 80 / 100 %. */
			intensity?: 1 | 2 | 3 | 4 | 5;
	  };

type ShadowStatic = IconShadowValue | null | false | undefined;

/** Valore della shadow (anche funzione / `Signal` per renderla reattiva; `null | false | undefined` → nessuna shadow). */
export type IconShadow = ShadowStatic | (() => ShadowStatic);

export type IconProps = SharedProps & {
	/** Chiavi di `icons.tsx` (autocomplete completo). */
	name: Icon;
	/**
	 * Scala `clientConfig.style.icon` (`size={2}` / `size="3"`), px numerici, o CSS (`24px`).
	 * Se **omesso**: larghezza/altezza = `1em` → segue il `font-size` del contesto (es. `text-6` sul genitore).
	 */
	size?: string | number;
	stroke?: string | number;
	/**
	 * Glow reattivo sull’SVG (`filter: drop-shadow`). Passa un valore fisso, un `Signal`
	 * o una funzione: i cambi vengono animati con la `transition` globale.
	 */
	shadow?: IconShadow;
};

/** Registra un’icona extra (template clonato a ogni `<icon name={…} />`, come le built-in). */
export function registerIcon(name: string, template: SVGElement): void {
	customTemplates.set(name, template);
}

function resolveTemplate(name: string): SVGElement | undefined {
	if (Object.prototype.hasOwnProperty.call(glyphs, name)) {
		const g = glyphs[name as Icon];
		return g instanceof SVGElement ? g : undefined;
	}
	return customTemplates.get(name);
}

function isExplicitCssSize(s: string): boolean {
	return CSS_LENGTH_RE.test(s) || isCssVarToken(s) || s.startsWith("clamp(");
}

/** `size={2}` / `size="3"` → chiavi in `clientConfig.style.icon`; numeri senza scala → `px`; stringhe esplicite (`24px`, `clamp(...)`) passano così. */
function resolveIconSizeProp(size: string | number): string {
	if (typeof size === "number") {
		const from = resolveIconSizeFromScaleKey(String(size));
		if (from) return from;
		return `${size}px`;
	}
	if (isExplicitCssSize(size)) return size;
	const from = resolveIconSizeFromScaleKey(size);
	if (from) return from;
	return size;
}

const SHADOW_BLUR_PX: Record<number, string> = { 1: "4px", 2: "8px", 3: "14px", 4: "22px", 5: "32px" };
const SHADOW_INTENSITY_ALPHA: Record<number, number> = { 1: 0.2, 2: 0.4, 3: 0.6, 4: 0.8, 5: 1 };

/** `blur` / `intensity` 1–5 → `filter: drop-shadow(0 0 <blur> <color-alpha>)`; `null`/`false` → nessun filter. */
function buildShadowFilter(shadow: IconShadowValue | null | false | undefined): string {
	if (shadow == null || shadow === false) return "";
	const isObj = typeof shadow === "object";
	const rawColor = (isObj ? shadow.color : shadow) ?? "primary";
	const blurLevel = (isObj && shadow.blur) || 2;
	const intensityLevel = (isObj && shadow.intensity) || 3;
	const blurPx = SHADOW_BLUR_PX[blurLevel] ?? SHADOW_BLUR_PX[2]!;
	const alpha = SHADOW_INTENSITY_ALPHA[intensityLevel] ?? SHADOW_INTENSITY_ALPHA[3]!;
	let colorCss: string;
	if (rawColor === "primary") colorCss = `rgba(0, 243, 210, ${alpha})`;
	else if (rawColor === "secondary") colorCss = `rgba(27, 27, 27, ${alpha})`;
	else colorCss = rawColor;
	return `drop-shadow(0 0 ${blurPx} ${colorCss})`;
}

function readShadowValue(v: IconShadow | undefined): ShadowStatic {
	if (v == null || v === false) return v;
	if (typeof v === "function") return (v as () => ShadowStatic)();
	return v;
}

/** Token `shadow-*` → `dshadow-*` (`filter: drop-shadow` sul glifo, non `box-shadow` sul box). */
function shadowTokenToDshadow(token: string): string {
	const { base, suffix } = parseStyleToken(token);
	if (base !== "shadow") return token;
	return suffix ? `dshadow-${suffix}` : "dshadow";
}

function readCond(v: unknown): boolean {
	if (v === true) return true;
	if (v === false || v == null) return false;
	if (typeof v === "function") return !!(v as () => unknown)();
	if (isSignal(v)) return !!(v as Signal<unknown>)();
	/** `[Signal, rhs]` → attivo se `signal() === rhs` (stessa semantica di `condenseConditionalTokenMap`). */
	if (Array.isArray(v) && v.length === 2 && isSignal(v[0])) {
		const right = typeof v[1] === "function" ? (v[1] as () => unknown)() : v[1];
		return Object.is((v[0] as Signal<unknown>)(), right);
	}
	if (isStyleEqDescriptor(v)) {
		const right = typeof v.rhs === "function" ? (v.rhs as () => unknown)() : v.rhs;
		return Object.is(v.signal(), right);
	}
	return !!v;
}

/** Ricava una stringa piatta di token attivi da `s` (stringa | `{ base: ... }`); `null` se formato non supportato per split. */
function flattenIconStyleToTokenString(v: unknown): string | null {
	if (typeof v === "string") return v;
	if (v == null || typeof v !== "object" || Array.isArray(v)) return null;
	const layer = v as StyleLayerInput;
	/** Per ora lo split gestisce solo `base` (gli altri rami — mob/tab/des/animate/class — restano sull’SVG). */
	for (const k of Object.keys(layer)) {
		if (k !== "base") return null;
	}
	const base = layer.base;
	const parts: string[] = [];
	const pushFrom = (raw: unknown): void => {
		if (raw == null || raw === false) return;
		if (typeof raw === "string") {
			parts.push(raw);
			return;
		}
		if (Array.isArray(raw)) {
			for (const it of raw) {
				const u = unwrapConditional<string>(it);
				if (typeof u === "string") parts.push(u);
			}
			return;
		}
		if (typeof raw === "object") {
			for (const [tokens, cond] of Object.entries(raw as Record<string, unknown>)) {
				if (tokens === "__") {
					if (typeof cond === "string") parts.push(cond);
					continue;
				}
				if (readCond(cond)) parts.push(tokens);
			}
		}
	};
	pushFrom(base);
	return parts.join(" ");
}

/** `text` / `font` / `shadow` sul solo SVG; il resto (bg, padding, round, …) sul contenitore. */
function splitIconStyleString(str: string): { wrap: string; svg: string; hasCircle: boolean } {
	const vp = styleViewport();
	const active = activeTokensFromString(str, vp);
	const tokens = tokenizeStyleString(active);
	const wrap: string[] = [];
	const svg: string[] = [];
	let hasCircle = false;
	for (const t of tokens) {
		if (/^(mob|tab|des):/.test(t) || /^hover:\(/i.test(t)) {
			wrap.push(t);
			continue;
		}
		const { base, suffix } = parseStyleToken(t);
		if (base === "round" && suffix === "circle") hasCircle = true;
		if (base === "text" || base === "font" || base === "shadow") {
			svg.push(base === "shadow" ? shadowTokenToDshadow(t) : t);
		} else {
			wrap.push(t);
		}
	}
	return { wrap: wrap.join(" "), svg: svg.join(" "), hasCircle };
}

export function icon(props: IconProps): UiNode {
	const { name, size, stroke, shadow, children: _c, s: sProp, ...rest } = props;
	const src = resolveTemplate(name);
	if (src == null) {
		return null;
	}
	const svg = src.cloneNode(true) as SVGElement;

	const firstFlat = flattenIconStyleToTokenString(sProp);
	const useSplit = firstFlat != null && firstFlat.trim() !== "";
	let wrapEl: HTMLSpanElement | null = null;

	if (useSplit) {
		/**
		 * `s` dell’icona può contenere rhs reattivi (`"text-primary": tab() === id`).
		 * Lo split va rieseguito a ogni tick: passiamo a `applyStyle` **funzioni** che
		 * ricalcolano la stringa di token per wrap e svg.
		 */
		const splitFirst = splitIconStyleString(firstFlat);
		const hasCircle = splitFirst.hasCircle;
		const hasWrap = splitFirst.wrap.trim() !== "";
		const hasSvg = splitFirst.svg.trim() !== "" || firstFlat.trim() !== "";
		if (hasWrap) {
			wrapEl = document.createElement("span");
			applyStyle(wrapEl, () => {
				const flat = flattenIconStyleToTokenString(sProp);
				return flat != null ? splitIconStyleString(flat).wrap : "";
			});
			const d = wrapEl.style.display;
			if (d !== "flex" && d !== "inline-flex" && d !== "grid") {
				wrapEl.style.display = "inline-flex";
				wrapEl.style.alignItems = "center";
				wrapEl.style.justifyContent = "center";
			}
			/** `round-circle` su un box non quadrato diventa ellisse: forza `aspect-ratio: 1` così il wrapper è un cerchio vero. */
			if (hasCircle) wrapEl.style.aspectRatio = "1";
			applyDomProps(wrapEl, { ...rest, children: undefined } as DomProps);
		} else {
			applyDomProps(svg, { ...rest, children: undefined } as DomProps);
		}
		if (hasSvg) {
			applyStyle(svg, () => {
				const flat = flattenIconStyleToTokenString(sProp);
				return flat != null ? splitIconStyleString(flat).svg : "";
			});
		}
	} else {
		applyDomProps(svg, { ...rest, children: undefined, s: sProp } as DomProps);
	}

	/** `border-box` su SVG + `p-*` riduce l’area del disegno; `content-box` fa sì che padding/bg espandano il box mantenendo l’icona a `width`/`height`. */
	svg.style.boxSizing = "content-box";
	if (size == null) {
		svg.removeAttribute("width");
		svg.removeAttribute("height");
		svg.style.width = "1em";
		svg.style.height = "1em";
		svg.style.display = "inline-block";
		svg.style.verticalAlign = "middle";
	} else {
		const s = resolveIconSizeProp(size);
		svg.setAttribute("width", s);
		svg.setAttribute("height", s);
	}
	if (stroke != null) svg.setAttribute("stroke-width", String(stroke));

	if (shadow !== undefined) {
		/** Di default gli SVG clippano al viewBox: il glow di `drop-shadow` resterebbe nascosto fuori dal glifo. */
		svg.style.overflow = "visible";
		const isReactive = typeof shadow === "function" || isSignal(shadow);
		if (isReactive) {
			const stop = watch(() => {
				const f = buildShadowFilter(readShadowValue(shadow));
				if (f) svg.style.filter = f;
				else svg.style.removeProperty("filter");
			});
			onNodeDispose(svg, stop);
		} else {
			const f = buildShadowFilter(shadow as ShadowStatic);
			if (f) svg.style.filter = f;
		}
	}

	/**
	 * Gli attributi SVG `stroke`/`fill` NON sono animati dal `transition-property: all` globale
	 * (solo le proprietà **CSS** lo sono). Se l’attributo è `currentColor`, lo promuoviamo a
	 * proprietà CSS così il cambio di `color` (es. toggle di `text-primary`) viene interpolato.
	 */
	if (svg.getAttribute("stroke") === "currentColor") {
		svg.removeAttribute("stroke");
		svg.style.stroke = "currentColor";
	}
	if (svg.getAttribute("fill") === "currentColor") {
		svg.removeAttribute("fill");
		svg.style.fill = "currentColor";
	}

	if (wrapEl) {
		wrapEl.appendChild(svg);
		return wrapEl;
	}
	return svg;
}

export * from "./icons";
