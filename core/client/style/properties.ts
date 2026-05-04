import type { Properties } from "csstype";
import { B_ANIM_FILL, B_ANIM_RGB, normalizeAnimatedPower } from "./properties/b-animated";
import { backgroundColor } from "./properties/background";
import {
	bgBlur,
	bgBrightness,
	bgContrast,
	bgHueRotate,
	bgSaturate,
} from "./properties/bgdrop";
import { blur } from "./properties/blur";
import { border, borderBottom, borderLeft, borderRight, borderTop } from "./properties/border";
import { font } from "./properties/font";
import * as g from "./properties/gap";
import { h } from "./properties/h";
import { maxh } from "./properties/maxh";
import { maxw } from "./properties/maxw";
import { minh } from "./properties/minh";
import { minw } from "./properties/minw";
import { w } from "./properties/w";
import * as m from "./properties/margin";
import * as p from "./properties/padding";
import { opacity as opacityFn } from "./properties/opacity";
import {
	round,
	roundb,
	roundbl,
	roundbr,
	roundl,
	roundr,
	roundt,
	roundtl,
	roundtr,
} from "./properties/round";
import { rotate as rotateFn } from "./properties/rotate";
import { text } from "./properties/text";
import { zIndex } from "./properties/zIndex";
import { gridTemplateColumnsEqual, gridTemplateRowsEqualFlowColumn } from "./properties/grid-axis";
import { translateX as translateXFn, translateY as translateYFn } from "./properties/translate";
import { childrenAlign } from "./properties/children-align";
import { selfAlign } from "./properties/self-align";
import { scaleTransform } from "./properties/transform-scale";
import { transformOrigin } from "./properties/transform-origin";
import { easeTiming, transitionDurationToken } from "./properties/transition-tokens";
import { eventsPointer, noPrefix } from "./properties/pointer-events";
import { resolveSpacingToken } from "./properties/utils/units";
import { aspect } from "./properties/aspect";

/**
 * `dshadow-*`: scala **blur** (1–5) e **intensity** (1–5) mappate a variabili CSS così più token
 * nello stesso elemento si combinano senza sovrascriversi (`filter` finale è un’unica `drop-shadow`
 * che legge `--fw-dsh-blur` / `--fw-dsh-color`).
 */
const DSHADOW_BLUR_SCALE: Record<string, string> = {
  "1": "4px",
  "2": "8px",
  "3": "14px",
  "4": "22px",
  "5": "32px",
};

const DSHADOW_INTENSITY_SCALE: Record<string, number> = {
  "1": 0.2,
  "2": 0.4,
  "3": 0.6,
  "4": 0.8,
  "5": 1,
};

const DSHADOW_PALETTE_RGB: Record<string, string> = {
  primary: "0, 243, 210",
  secondary: "27, 27, 27",
};

const DSHADOW_VAR_BLUR = "--fw-dsh-blur";
const DSHADOW_VAR_RGB = "--fw-dsh-rgb";
const DSHADOW_VAR_ALPHA = "--fw-dsh-alpha";

const DSHADOW_FILTER = `drop-shadow(0 0 var(${DSHADOW_VAR_BLUR}, 8px) rgba(var(${DSHADOW_VAR_RGB}, 0, 243, 210), var(${DSHADOW_VAR_ALPHA}, 0.6)))`;

/** Valori storici `aborder-power-1` … `5`; oltre si usa `normalizeAnimatedPower`. */
const ABORDER_LEGACY_POWER: Record<string, string> = {
	"1": "0.32",
	"2": "0.48",
	"3": "0.65",
	"4": "0.82",
	"5": "1",
};

function resolveAborder(suffix: string): Properties | undefined {
	const s = suffix.trim();
	if (!s) return undefined;

	if (s.startsWith("face-")) {
		const rest = s.slice("face-".length);
		if (/^[0-9a-fA-F]{3,8}$/.test(rest)) {
			return { ["--fw-ab-fill"]: `#${rest}` } as Properties;
		}
		const preset = B_ANIM_FILL[rest];
		return preset ? ({ ["--fw-ab-fill"]: preset } as Properties) : undefined;
	}

	if (s.startsWith("power-")) {
		const raw = s.slice("power-".length);
		const legacy = ABORDER_LEGACY_POWER[raw];
		if (legacy) return { ["--fw-ab-power"]: legacy } as Properties;
		const num = Number(raw);
		if (!Number.isNaN(num) && num > 0) {
			return { ["--fw-ab-power"]: normalizeAnimatedPower(num) } as Properties;
		}
		return undefined;
	}

	if (s.startsWith("tint-")) {
		const k = s.slice("tint-".length);
		const rgb = B_ANIM_RGB[k];
		if (!rgb) return undefined;
		return {
			["--fw-ab-rgb"]: rgb,
			["--fw-ab-mesh-rgb-a"]: rgb,
		} as Properties;
	}

	if (s.startsWith("mesh2-")) {
		const k = s.slice("mesh2-".length);
		const rgb = B_ANIM_RGB[k];
		return rgb ? ({ ["--fw-ab-mesh-rgb-b"]: rgb } as Properties) : undefined;
	}

	if (s.startsWith("spread-")) {
		const raw = s.slice("spread-".length);
		const n = Number(raw.replace(/px$/i, ""));
		if (!Number.isNaN(n) && n > 0) {
			const px = Math.min(80, Math.max(4, n));
			return { ["--fw-ab-spread"]: `${px}px` } as Properties;
		}
		return undefined;
	}

	return undefined;
}

function resolveDshadow(suffix: string): Properties | undefined {
  if (!suffix) return undefined;
  const parts = suffix.split("-");
  const head = parts[0]!;

  if (head === "blur" && parts[1] && DSHADOW_BLUR_SCALE[parts[1]]) {
    return {
      [DSHADOW_VAR_BLUR]: DSHADOW_BLUR_SCALE[parts[1]]!,
      filter: DSHADOW_FILTER,
    } as Properties;
  }

  if (head === "intensity" && parts[1] && DSHADOW_INTENSITY_SCALE[parts[1]] != null) {
    return {
      [DSHADOW_VAR_ALPHA]: String(DSHADOW_INTENSITY_SCALE[parts[1]]),
      filter: DSHADOW_FILTER,
    } as Properties;
  }

  if (DSHADOW_PALETTE_RGB[head]) {
    return {
      [DSHADOW_VAR_RGB]: DSHADOW_PALETTE_RGB[head]!,
      filter: DSHADOW_FILTER,
    } as Properties;
  }

  return undefined;
}

/** Card sollevata (`box-shadow`): bordo chiaro in alto + ombre stratificate. */
const SHADOW_CARD: Properties = {
	boxShadow:
		"0 1px 0 rgba(255, 255, 255, 0.09) inset, 0 2px 4px rgba(0, 0, 0, 0.45), 0 8px 20px rgba(0, 0, 0, 0.4), 0 20px 44px rgba(0, 0, 0, 0.35)",
};

const SHADOW_CARD_SM: Properties = {
	boxShadow:
		"0 1px 0 rgba(255, 255, 255, 0.06) inset, 0 1px 3px rgba(0, 0, 0, 0.35), 0 4px 12px rgba(0, 0, 0, 0.32)",
};

const SHADOW_CARD_LG: Properties = {
	boxShadow:
		"0 1px 0 rgba(255, 255, 255, 0.1) inset, 0 4px 8px rgba(0, 0, 0, 0.5), 0 12px 28px rgba(0, 0, 0, 0.45), 0 28px 56px rgba(0, 0, 0, 0.38)",
};

/** `shadow-card*` → box UI; tutto il resto → stesso contratto di `dshadow-*` (glow). */
function resolveShadow(suffix: string): Properties | undefined {
	const s = suffix.trim();
	if (!s) return undefined;
	if (s === "card") return SHADOW_CARD;
	if (s === "card-sm") return SHADOW_CARD_SM;
	if (s === "card-lg") return SHADOW_CARD_LG;
	return resolveDshadow(s);
}

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
  /**
   * Suffisso lunghezza → `filter: blur(…)` sul **contenuto** del nodo.
   * Per sfocare **lo sfondo dietro** il box componi i token `bgblur-*`, `bgsaturate-*`, … (vedi `./properties/bgdrop`):
   * finiscono in un’unica catena `backdrop-filter` / `WebkitBackdropFilter` in ordine di scrittura.
   */
  blur: blur,
  /** Intero → `blur(Npx)`; altrimenti lunghezza (`12px`, `1rem`, …). Segmento `backdrop-filter`. */
  bgblur: bgBlur,
  /** `180%` oppure moltiplicatore `1.65`. Segmento `backdrop-filter`. */
  bgsaturate: bgSaturate,
  /** `105%` o `1.05`. Segmento `backdrop-filter`. */
  bgbrightness: bgBrightness,
  /** `110%` o `1.1`. Segmento `backdrop-filter`. */
  bgcontrast: bgContrast,
  /** `12deg` o `12`. Segmento `backdrop-filter` (`hue-rotate`). */
  bghue: bgHueRotate,
  /**
   * **`shadow-card`** / **`shadow-card-sm`** / **`shadow-card-lg`** → `box-shadow` da card sollevata (riuso su qualsiasi contenitore).
   * **`shadow(…)`** → `box-shadow`: legacy `shadow(colore, 14, 2, 6, 0.5)` oppure nomi (`blur-*`, `spread-*`, `x-*` / `y-*`, anche **`x--4`** / **`-x-4`** per negativi, `pos-*`, `opacity-*`). Attenzione: **`overflow-hidden` sullo stesso nodo taglia l’ombra** — metti l’ombra su un wrapper esterno.
   * **`shadow-*`** altrimenti → come **`dshadow-*`** (`filter: drop-shadow`, glow sul glifo/box).
   * Su `<icon>`, i token `shadow-*` nella stringa `s` diventano `dshadow-*` sull’SVG interno (il formato **`shadow(...)`** resta sul contenitore, non sull’SVG).
   *
   * Token **combinabili** (glow; ogni token aggiunge una parte):
   * - **colore**: `shadow-primary` / `dshadow-secondary` …
   * - **blur-N** (1–5): `shadow-blur-1` …
   * - **intensity-N** (1–5): `shadow-intensity-1` …
   */
  shadow: (suffix: string) => resolveShadow(suffix.trim()),
  /**
   * Solo glow `filter: drop-shadow` (equivalente a `shadow-*` se non è `shadow-card*`).
   */
  dshadow: (suffix: string) => {
    return resolveDshadow(suffix.trim());
  },
  /**
   * Bordi animati — **`b-animated(…)`**: `single|double`, colori (su `single`, 3+ = faccia + palette glow in ordine), poi `blur-*` … (vedi `resolveBAnimatedToken`).
   * Oppure: `fw-ab-*` + `aborder-face-*`, `power-*`, `tint-*`, `mesh2-*`, **`aborder-spread-32`** (px, max 80).
   */
  aborder: (suffix: string) => resolveAborder(suffix),
  text: text,
  font: font,
  minw: minw,
  maxw: maxw,
  minh: minh,
  maxh: maxh,
  wmax: maxw,
  hmax: maxh,
  hmin: minh,
  w: w,
  h: h,
  z: zIndex,
  opacity: opacityFn,
  round: round,
  /** Angoli singoli / lati: stessi suffissi di `round-*` (`roundt-5`, `roundt-round`, `roundtl-10px`, …). */
  roundt: roundt,
  roundb: roundb,
  roundl: roundl,
  roundr: roundr,
  roundtl: roundtl,
  roundtr: roundtr,
  roundbl: roundbl,
  roundbr: roundbr,
  rotate: rotateFn,
  rotat: rotateFn,
  /** `scale-130` → `transform: scale(1.3)` (numeri > 10 → /100). */
  scale: scaleTransform,
  /** `origin-left|right|top|bottom|center|tl|tr|bl|br` → `transform-origin`. Combina con `scale-*` per scalare verso un lato. */
  origin: transformOrigin,
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
  /** `ly-100%` / `ly-3.5rem` → `top` arbitrario (come `lx` per `left`; utile sotto un trigger in `absolute`). */
  ly: (suffix: string) => {
    let s = suffix.trim();
    if (!s) return undefined;
    if (s.includes("calc(")) s = s.replace(/%-/g, "% - ");
    return { top: s };
  },
  /** `rx-100%` / `rx-1rem` → `right` arbitrario (specchio di `lx`; utile per ancorare a sinistra di un trigger in `absolute`). */
  rx: (suffix: string) => {
    let s = suffix.trim();
    if (!s) return undefined;
    if (s.includes("calc(")) s = s.replace(/%-/g, "% - ");
    return { right: s };
  },
  /** `ry-100%` / `ry-1rem` → `bottom` arbitrario (specchio di `ly`; utile per ancorare sopra un trigger in `absolute`). */
  ry: (suffix: string) => {
    let s = suffix.trim();
    if (!s) return undefined;
    if (s.includes("calc(")) s = s.replace(/%-/g, "% - ");
    return { bottom: s };
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
  block: { display: "block" },
  /** `overflow-hidden` (parser: base `overflow`, suffisso `hidden`). */
  overflow: (suffix: string) =>
    suffix === "hidden" ? { overflow: "hidden" as const } : undefined,
  /** `scrollx` → scroll orizzontale (usa con `row` + `maxw-*`/`w-*`). */
  scrollx: { overflowX: "auto", overflowY: "hidden", flexWrap: "nowrap" },
  /** `scrolly` → scroll verticale (usa con `col` + `maxh-*`/`h-*`). */
  scrolly: { overflowY: "auto", overflowX: "hidden", flexWrap: "nowrap" },
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

  /** `tbl-fixed` → `table-layout: fixed`. */
  tbl: (suffix: string) => (suffix === "fixed" ? { tableLayout: "fixed" as const } : undefined),
  /** `bcollapse-separate` / `bcollapse-collapse` → `border-collapse`. */
  bcollapse: (suffix: string) => {
    if (suffix === "separate") return { borderCollapse: "separate" as const };
    if (suffix === "collapse") return { borderCollapse: "collapse" as const };
    return undefined;
  },
  /** `bspace-0` → `border-spacing: 0` (altri suffissi come spacing token). */
  bspace: (suffix: string) => {
    if (!suffix) return undefined;
    if (suffix === "0") return { borderSpacing: "0" };
    const t = resolveSpacingToken(suffix, "box");
    return t ? { borderSpacing: t } : undefined;
  },
  /** `valign-middle` / `valign-top` / `valign-bottom` / `valign-baseline` → `vertical-align`. */
  valign: (suffix: string) => {
    if (suffix === "middle" || suffix === "top" || suffix === "bottom" || suffix === "baseline") {
      return { verticalAlign: suffix };
    }
    return undefined;
  },
  /** `tover-ellipsis` → `text-overflow: ellipsis`. */
  tover: (suffix: string) =>
    suffix === "ellipsis" ? { textOverflow: "ellipsis" as const } : undefined,
  /** `ws-nowrap` → `white-space: nowrap`. */
  ws: (suffix: string) =>
    suffix === "nowrap" ? { whiteSpace: "nowrap" as const } : undefined,
  /** `aspect-square` / `aspect-16/9` / `aspect-1` → `aspect-ratio`. */
  aspect: aspect,
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
