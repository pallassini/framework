import type { Properties } from "csstype";
import { backgroundColor } from "./properties/background";
import { border } from "./properties/border";
import { font } from "./properties/font";
import * as g from "./properties/gap";
import { minw } from "./properties/minw";
import * as m from "./properties/margin";
import * as p from "./properties/padding";
import { round } from "./properties/round";
import { text } from "./properties/text";
import { zIndex } from "./properties/zIndex";

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
  bg: backgroundColor,
  text: text,
  font: font,
  minw: minw,
  z: zIndex,
  round: round,

  /** Marcatore per figli di `layers`: abilita varianti `layer` su left/right/top/bottom/center*. */
  layer: {},

  // POSITION
  absolute: { position: "absolute" },
  relative: { position: "relative" },
  fixed: { position: "fixed" },
  sticky: { position: "sticky" },

  // DIRECTION
  row: { display: "flex", flexDirection: "row" },
  col: { display: "flex", flexDirection: "column" },

  /** Impila i figli nella stessa cella a griglia, centrati (serve regola CSS su `[data-fw-layers] > *`). */
  layers: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gridTemplateRows: "1fr",
    placeItems: "center",
    position: "relative",
  },

  // ALIGNMENT
  left: {
    default: { justifyContent: "flex-start" },
    variants: {
      row: { justifyContent: "flex-start" },
      col: { alignItems: "flex-start" },
      "absolute,fixed,sticky": { left: 0 },
      layer: { justifySelf: "start" },
    },
  },
  right: {
    default: { justifyContent: "flex-end" },
    variants: {
      row: { justifyContent: "flex-end" },
      col: { alignItems: "flex-end" },
      "absolute,fixed,sticky": { right: 0 },
      layer: { justifySelf: "end" },
    },
  },
  top: {
    default: { alignItems: "flex-start" },
    variants: {
      row: { alignItems: "flex-start" },
      col: { justifyContent: "flex-start" },
      "absolute,fixed,sticky": { top: 0 },
      layer: { alignSelf: "start" },
    },
  },
  bottom: {
    default: { alignItems: "flex-end" },
    variants: {
      row: { alignItems: "flex-end" },
      col: { justifyContent: "flex-end" },
      "absolute,fixed,sticky": { bottom: 0 },
      layer: { alignSelf: "end" },
    },
  },
  centerX: {
    default: { justifyContent: "center" },
    variants: {
      row: { justifyContent: "center" },
      col: { alignItems: "center" },
      "absolute,fixed,sticky": { left: "50%", transform: "translateX(-50%)" },
      layer: { justifySelf: "center" },
    },
  },
  centerY: {
    default: { alignItems: "center" },
    variants: {
      row: { alignItems: "center" },
      col: { justifyContent: "center" },
      "absolute,fixed,sticky": { top: "50%", transform: "translateY(-50%)" },
      layer: { alignSelf: "center" },
    },
  },
  center: {
    default: { justifyContent: "center", alignItems: "center" },
    variants: {
      row: { justifyContent: "center", alignItems: "center" },
      col: { justifyContent: "center", alignItems: "center" },
      "absolute,fixed,sticky": { left: "50%", top: "50%", transform: "translate(-50%, -50%)" },
      layer: { justifySelf: "center", alignSelf: "center" },
    },
  },
});

// TYPES
type MapEntry = (typeof map)[keyof typeof map];

export type StyleVariantKey = MapEntry extends { default: StyleResolver | Properties; variants?: infer V }
	? V extends Record<string, unknown>
		? keyof V & string
		: never
	: never;

export type * from "./properties/utils/color";
export type StyleResolver = (suffix: string) => Properties | undefined;

export type StyleGroup = {
	default: StyleResolver | Properties;
	variants?: Partial<Record<string, Properties | StyleResolver>>;
};

type StyleMapEntry = Properties | StyleResolver | StyleGroup;

export function styleMap<const T extends Record<string, StyleMapEntry>>(map: T): T {
  return map;
}
