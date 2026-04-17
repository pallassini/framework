import type { Properties } from "csstype";
import { backgroundColor } from "./properties/background";
import { blur } from "./properties/blur";
import { border, borderBottom, borderLeft, borderRight, borderTop } from "./properties/border";
import { font } from "./properties/font";
import * as g from "./properties/gap";
import { h } from "./properties/h";
import { maxh } from "./properties/maxh";
import { maxw } from "./properties/maxw";
import { minw } from "./properties/minw";
import { w } from "./properties/w";
import * as m from "./properties/margin";
import * as p from "./properties/padding";
import { opacity as opacityFn } from "./properties/opacity";
import { round } from "./properties/round";
import { rotate as rotateFn } from "./properties/rotate";
import { text } from "./properties/text";
import { zIndex } from "./properties/zIndex";
import { gridTemplateColumnsEqual, gridTemplateRowsEqualFlowColumn } from "./properties/grid-axis";
import { translateX as translateXFn, translateY as translateYFn } from "./properties/translate";
import { childrenAlign } from "./properties/children-align";
import { selfAlign } from "./properties/self-align";
import { scaleTransform } from "./properties/transform-scale";
import { easeTiming, transitionDurationToken } from "./properties/transition-tokens";
import { eventsPointer, noPrefix } from "./properties/pointer-events";

/**
 * `center*` / `left` / `right` / `top` / `bottom` → questo box.
 * `left`/`right`/`top`/`bottom`: con `absolute`/`fixed`/`sticky` → inset; con `layer` → griglia;
 * altrimenti (static, relative, …) → margini come `centerx`/`centery` (allineamento in flex).
 * Per **figli** del flex genitore usa `children-*`.
 */
const CENTERX_GROUP = {
	default: { marginLeft: "auto", marginRight: "auto" },
	variants: {
		"absolute,fixed,sticky": { left: "50%", transform: "translateX(-50%)" },
		layer: { justifySelf: "center" },
	},
};

const CENTERY_GROUP = {
	default: { marginTop: "auto", marginBottom: "auto" },
	variants: {
		"absolute,fixed,sticky": { top: "50%", transform: "translateY(-50%)" },
		layer: { alignSelf: "center" },
	},
};

const CENTER_GROUP = {
	default: { marginLeft: "auto", marginRight: "auto", marginTop: "auto", marginBottom: "auto" },
	variants: {
		"absolute,fixed,sticky": { left: "50%", top: "50%", transform: "translate(-50%, -50%)" },
		layer: { justifySelf: "center", alignSelf: "center" },
	},
};

/** In flusso, `left`/`right`/`top`/`bottom` usano margini (su `static`/`relative` le proprietà CSS `left`/… non hanno effetto). */
const EDGE_LEFT_FLOW: Properties = { marginLeft: 0, marginRight: "auto" };
const EDGE_RIGHT_FLOW: Properties = { marginLeft: "auto", marginRight: 0 };
const EDGE_TOP_FLOW: Properties = { marginTop: 0, marginBottom: "auto" };
const EDGE_BOTTOM_FLOW: Properties = { marginTop: "auto", marginBottom: 0 };

export const map = styleMap({
  // BASICS
  m: m.margin,
  mt: m.marginTop,
  mr: m.marginRight,
  mb: m.marginBottom,
  ml: m.marginLeft,
  mx: m.marginX,
  my: m.marginY,
  p: p.padding,
  pt: p.paddingTop,
  pr: p.paddingRight,
  pb: p.paddingBottom,
  pl: p.paddingLeft,
  px: p.paddingX,
  py: p.paddingY,
  gap: g.gap,
  gapx: g.gapx,
  gapy: g.gapy,
  b: border,
  bt: borderTop,
  br: borderRight,
  bb: borderBottom,
  bl: borderLeft,
  bg: backgroundColor,
  blur: blur,
  text: text,
  font: font,
  minw: minw,
  maxw: maxw,
  maxh: maxh,
  wmax: maxw,
  hmax: maxh,
  w: w,
  h: h,
  z: zIndex,
  opacity: opacityFn,
  round: round,
  rotate: rotateFn,
  rotat: rotateFn,
  /** `scale-130` → `transform: scale(1.3)` (numeri > 10 → /100). */
  scale: scaleTransform,
  /** `duration-200ms` → `transition-duration`. */
  duration: transitionDurationToken,
  /** `ease` / `ease-out` / `ease-in` / `ease-in-out` → `transition-timing-function`. */
  ease: easeTiming,
  /** `linear` → `transition-timing-function: linear` (senza `ease-*` il default è `ease` del browser). */
  linear: { transitionTimingFunction: "linear" },
  /** `tx-12px` / `-tx-50%` → `transform: translateX(…)`. */
  tx: translateXFn,
  /** `ty-12px` / `-ty-50%` → `transform: translateY(…)`. */
  ty: translateYFn,
  /** `lx-calc(50%-50vw)` → `left: calc(50% - 50vw)` (normalizza spazi in `calc`). */
  lx: (suffix: string) => {
    let s = suffix.trim();
    if (!s) return undefined;
    if (s.includes("calc(")) s = s.replace(/%-/g, "% - ");
    return { left: s };
  },
  /** `translate-(-50%,-50%)` → `transform: translate(-50%,-50%)` (suffisso = ciò che va tra parentesi). */
  translate: (suffix: string) => {
    const s = suffix.trim();
    return s ? { transform: `translate${s}` } : undefined;
  },

  /** Marcatore per figli di `layers`: abilita varianti `layer` su left/right/top/bottom/center*. */
  layer: {},

  // POSITION
  absolute: { position: "absolute" },
  relative: { position: "relative" },
  fixed: { position: "fixed" },
  sticky: { position: "sticky" },
  /** Box assoluto inset 0 (come layer meteors sotto `relative`). */
  fill: { position: "absolute", inset: "0" },
  "overflow-hidden": { overflow: "hidden" },
  /** `no-events` → `pointer-events: none` (token `no` + suffisso `events`). */
  no: noPrefix,
  /** `events-none` / `events-auto` → `pointer-events`. */
  events: eventsPointer,
  layers: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gridTemplateRows: "1fr",
    placeItems: "center",
    position: "relative",
  },

  // DIRECTION
  /**
   * Flex: `row` / `col` senza suffisso.
   * Griglia: `row-N` / `col-N` con **N intero 1–24** (`col-2` = 2 colonne, ordine a zig-zag per riga;
   * `row-2` = 2 righe con `grid-auto-flow: column`, stesso schema per colonne).
   * Default `flex-wrap: nowrap` (più comune per barre e file orizzontali); usa `wrap` dopo `row` se serve andare a capo.
   */
  row: {
    default: (suffix) => {
      if (!suffix) return { display: "flex", flexDirection: "row", flexWrap: "nowrap" };
      return gridTemplateRowsEqualFlowColumn(suffix) ?? {
        display: "flex",
        flexDirection: "row",
        flexWrap: "nowrap",
      };
    },
  },
  col: {
    default: (suffix) => {
      if (!suffix) return { display: "flex", flexDirection: "column" };
      return gridTemplateColumnsEqual(suffix) ?? { display: "flex", flexDirection: "column" };
    },
  },
  /** I figli partecipano al layout del nonno (utile a “appiattire” gruppi in una `row` su desktop). */
  contents: { display: "contents" },
  /** Dopo `row`: forza `flex-wrap: nowrap` (es. se qualche segmento ha impostato `wrap`). */
  nowrap: { flexWrap: "nowrap" },
  /** Dopo `row`: `flex-wrap: wrap` (il default di `row` è `nowrap`). Ordine consigliato: `row wrap`. */
  wrap: { flexWrap: "wrap" },

  // ALIGNMENT (solo il box; figli flex → `children-*`)
  left: {
    default: EDGE_LEFT_FLOW,
    variants: {
      "absolute,fixed,sticky": { left: 0 },
      layer: { justifySelf: "start" },
    },
  },
  right: {
    default: EDGE_RIGHT_FLOW,
    variants: {
      "absolute,fixed,sticky": { right: 0 },
      layer: { justifySelf: "end" },
    },
  },
  top: {
    default: EDGE_TOP_FLOW,
    variants: {
      "absolute,fixed,sticky": { top: 0 },
      layer: { alignSelf: "start" },
    },
  },
  bottom: {
    default: EDGE_BOTTOM_FLOW,
    variants: {
      "absolute,fixed,sticky": { bottom: 0 },
      layer: { alignSelf: "end" },
    },
  },
  /** Allineamento orizzontale nel box (margin / layer / absolute). */
  centerx: CENTERX_GROUP,
  centerX: CENTERX_GROUP,
  centery: CENTERY_GROUP,
  centerY: CENTERY_GROUP,
  center: CENTER_GROUP,
  /** Figli in `row` / `col`: `children-center`, `children-left`, `children-top`, … */
  children: childrenAlign,
  /** Questo figlio nel flex genitore: `self-start`, `self-center`, … */
  self: selfAlign,
});

// TYPES
type MapEntry = (typeof map)[keyof typeof map];

export type StyleVariantKey = MapEntry extends {
  default: StyleResolver | Properties;
  variants?: infer V;
}
  ? V extends Record<string, unknown>
    ? keyof V & string
    : never
  : never;

export type * from "./properties/utils/color";
export type StyleResolverContext = { negative?: boolean; bases?: ReadonlySet<string> };

export type StyleResolver = (suffix: string, ctx?: StyleResolverContext) => Properties | undefined;

export type StyleGroup = {
  default: StyleResolver | Properties;
  variants?: Partial<Record<string, Properties | StyleResolver>>;
};

type StyleMapEntry = Properties | StyleResolver | StyleGroup;

export function styleMap<const T extends Record<string, StyleMapEntry>>(map: T): T {
  return map;
}
