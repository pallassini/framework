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

/**
 * `center` / `centerx` / `centery` / `left` / `right` / `top` / `bottom` → solo **posizione di questo box**
 * (margin auto, inset griglia `layer`, absolute…). Per flex **figli** usa `children-center`, `children-left`, …
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
  /** `tx-12px` / `-tx-50%` → `transform: translateX(…)`. */
  tx: translateXFn,
  /** `ty-12px` / `-ty-50%` → `transform: translateY(…)`. */
  ty: translateYFn,

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
  "no-events": { pointerEvents: "none" },
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
   */
  row: {
    default: (suffix) => {
      if (!suffix) return { display: "flex", flexDirection: "row", flexWrap: "wrap" };
      return gridTemplateRowsEqualFlowColumn(suffix) ?? {
        display: "flex",
        flexDirection: "row",
        flexWrap: "wrap",
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

  // ALIGNMENT (solo il box; figli flex → `children-*`)
  left: {
    default: {},
    variants: {
      "absolute,fixed,sticky": { left: 0 },
      layer: { justifySelf: "start" },
    },
  },
  right: {
    default: {},
    variants: {
      "absolute,fixed,sticky": { right: 0 },
      layer: { justifySelf: "end" },
    },
  },
  top: {
    default: {},
    variants: {
      "absolute,fixed,sticky": { top: 0 },
      layer: { alignSelf: "start" },
    },
  },
  bottom: {
    default: {},
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
