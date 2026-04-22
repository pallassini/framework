import { state, watch } from "client";
import { clientConfig } from "../../../config";
import { logInputDebug } from "./input/inputDebug";

/**
 * Converte "N" (in unità del canvas, stesse di w-N/h-N del framework) in rem.
 * w-N = N% della width del canvas, h-N = N% della height del canvas, espresso in rem.
 */
function canvasToRem(n: number, axis: "x" | "y"): string {
  const { width, height, remPx } = clientConfig.style.canvas;
  const px = ((axis === "x" ? width : height) * n) / 100;
  return `${px / remPx}rem`;
}

type Direction =
  | "center"
  | "top"
  | "bottom"
  | "left"
  | "right"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

export interface ConfirmOptions {
  /** Testo della domanda. Default "Sicuro?". */
  message?: string;
  /** Testo del pulsante conferma. Default "Sì". */
  confirm?: string;
  /** Testo del pulsante annulla. Default "No". */
  cancel?: string;
}

interface PopmenuProps {
  /** Contenuto dello stato chiuso (factory). */
  collapsed: () => unknown;
  /** Contenuto dello stato aperto (factory). */
  extended: () => unknown;
  /** Direzione di espansione. Default "bottom-right". */
  direction?: Direction;
  /**
   * Offset applicato **solo sullo stato aperto**, nelle stesse unità di `w-N` / `h-N`
   * del framework: `x` = % della width del canvas, `y` = % della height del canvas (es. 1.2, -3).
   * Il collapsed non si sposta mai. Ammette negativi.
   */
  offset?: { x?: number; y?: number };
  /** Stile della shell (passato con token del framework, es. "bg-#545454 round-20px"). */
  s?: unknown;
  /** Se `true` (o oggetto con opzioni), chiede conferma prima di chiudere (clickout / esc). */
  confirmCollapsed?: boolean | ConfirmOptions;
  /** Apre quando il mouse entra sulla shell. */
  hoverIn?: boolean;
  /** Chiude quando il mouse esce dalla shell (incluso il contenuto). */
  hoverOut?: boolean;
  /** Al primo `open=true`, mette focus sul primo input/textarea dentro l'extended. */
  autofocus?: boolean;
  /** Modalità cromatica base della shell. */
  mode?: "normal" | "light" | "dark" | "auto";
  /** Raggio angoli shell. Default globale: `var(--round)`. */
  round?: number | string;
  /** Raggio shell quando il popmenu è chiuso (solo collapsed). */
  collapsedRound?: number | string;
  /** Raggio shell quando il popmenu è aperto (solo extended). */
  extendedRound?: number | string;
  /**
   * Ombra della shell quando è aperta.
   * - `true`: usa i token CSS globali `--popmenuShadow*`
   * - oggetto: override puntuale
   */
  shadow?: boolean | {
    x?: number;
    y?: number;
    blur?: number;
    spread?: number;
    color?: string;
    /** Opacità base ombra (0..1). Default: token CSS o 1. */
    opacity?: number;
    /** Moltiplicatore finale dell'ombra. 1 = normale, >1 più forte. */
    intensity?: number;
  };
}

type Axis = "top" | "bottom" | "left" | "right";

interface DirSpec {
  vx: -1 | 0 | 1;
  vy: -1 | 0 | 1;
  sides: Axis[];
  transform?: string;
}

const DIRS: Record<Direction, DirSpec> = {
  "center":       { vx:  0, vy:  0, sides: [],                   transform: "translate(-50%, -50%)" },
  "top":          { vx:  0, vy: -1, sides: ["bottom"],           transform: "translateX(-50%)" },
  "bottom":       { vx:  0, vy:  1, sides: ["top"],              transform: "translateX(-50%)" },
  "left":         { vx: -1, vy:  0, sides: ["right"],            transform: "translateY(-50%)" },
  "right":        { vx:  1, vy:  0, sides: ["left"],             transform: "translateY(-50%)" },
  "top-left":     { vx: -1, vy: -1, sides: ["bottom", "right"] },
  "top-right":    { vx:  1, vy: -1, sides: ["bottom", "left"]  },
  "bottom-left":  { vx: -1, vy:  1, sides: ["top",    "right"] },
  "bottom-right": { vx:  1, vy:  1, sides: ["top",    "left"]  },
};

function computeShellPosition(dir: DirSpec, offset: { x?: number; y?: number }): {
  styles: Partial<Record<Axis, string>>;
  transform?: string;
} {
  const ox = offset.x ?? 0;
  const oy = offset.y ?? 0;
  const oxRem = canvasToRem(ox, "x");
  const oyRem = canvasToRem(oy, "y");
  const styles: Partial<Record<Axis, string>> = {};
  let extraTx = "";
  let extraTy = "";

  for (const side of dir.sides) {
    if (side === "left")   styles.left   = oxRem;
    if (side === "right")  styles.right  = oxRem;
    if (side === "top")    styles.top    = oyRem;
    if (side === "bottom") styles.bottom = oyRem;
  }

  if (dir.vx === 0) {
    styles.left = "50%";
    if (ox !== 0) extraTx = oxRem;
  }
  if (dir.vy === 0) {
    styles.top = "50%";
    if (oy !== 0) extraTy = oyRem;
  }

  let transform = dir.transform;
  if (extraTx || extraTy) {
    const base = transform ?? "";
    const extra = `translate(${extraTx || "0"}, ${extraTy || "0"})`;
    transform = base ? `${base} ${extra}` : extra;
  }
  return { styles, transform };
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function tryParseRgb(input: string): { r: number; g: number; b: number; a: number } | null {
  const m = input
    .trim()
    .match(/^rgba?\(\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*[, ]\s*([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)$/i);
  if (!m) return null;
  const r = Number(m[1]);
  const g = Number(m[2]);
  const b = Number(m[3]);
  const a = m[4] === undefined ? 1 : Number(m[4]);
  if (![r, g, b, a].every(Number.isFinite)) return null;
  return {
    r: clamp(Math.round(r), 0, 255),
    g: clamp(Math.round(g), 0, 255),
    b: clamp(Math.round(b), 0, 255),
    a: clamp(a, 0, 1),
  };
}

function strengthenShadowColor(rawColor: string, strength: number): string {
  const s = Math.max(0, strength);
  const parsed = tryParseRgb(rawColor);
  if (parsed) {
    const alpha = clamp(parsed.a * s, 0, 1);
    return `rgba(${parsed.r}, ${parsed.g}, ${parsed.b}, ${alpha})`;
  }
  if (s <= 0) return "transparent";
  if (s === 1) return rawColor;
  const pct = clamp(Math.round(s * 100), 0, 100);
  return `color-mix(in srgb, ${rawColor} ${pct}%, transparent)`;
}

function observeSize(setW: (v: number) => void, setH: (v: number) => void) {
  return ((el) => {
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      if (!entry) return;
      /**
       * Usa borderBoxSize se disponibile: include padding+border (corretto per shell con box-sizing border-box).
       * Fallback a offsetWidth/Height (anch'essi border-box).
       */
      const target = entry.target as HTMLElement;
      const bb = entry.borderBoxSize;
      let w: number;
      let h: number;
      if (bb && bb.length > 0) {
        w = bb[0].inlineSize;
        h = bb[0].blockSize;
      } else {
        w = target.offsetWidth;
        h = target.offsetHeight;
      }
      setW(Math.ceil(w));
      setH(Math.ceil(h));
    });
    ro.observe(el as Element);
    return () => ro.disconnect();
  }) as (el: HTMLElement | SVGElement | null) => (() => void) | void;
}

const measureHostStyle: Record<string, string> = {
  position: "fixed",
  top: "0",
  left: "0",
  width: "max-content",
  height: "max-content",
  visibility: "hidden",
  pointerEvents: "none",
  zIndex: "-1",
  boxSizing: "border-box",
};

/** Rileva utenti con `prefers-reduced-motion`. Se true, le animazioni sono istantanee. */
function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Inietta una volta il keyframe del bounce "premium": scale morbido che simula
 * una presa elastica (spring damping).
 */
let bounceKeyframeInjected = false;
function ensureBounceKeyframe() {
  if (bounceKeyframeInjected || typeof document === "undefined") return;
  bounceKeyframeInjected = true;
  const el = document.createElement("style");
  el.setAttribute("data-fw", "popmenu-bounce");
  /**
   * Due keyframe identici con nomi alternati: permettono di riavviare l'animazione
   * ad ogni tap insistito cambiando semplicemente animation-name.
   */
  const kf = (name: string) => `
    @keyframes ${name} {
      0%   { transform: var(--popmenu-base-transform, none) scale(1); }
      18%  { transform: var(--popmenu-base-transform, none) scale(1.035); }
      36%  { transform: var(--popmenu-base-transform, none) scale(0.975); }
      56%  { transform: var(--popmenu-base-transform, none) scale(1.018); }
      78%  { transform: var(--popmenu-base-transform, none) scale(0.992); }
      100% { transform: var(--popmenu-base-transform, none) scale(1); }
    }
  `;
  el.textContent = kf("popmenu-bounce-a") + kf("popmenu-bounce-b");
  document.head.appendChild(el);
}

/** Token iniettati sulla shell (fallback) quando il Field non ha `mode` / usa variabili `--fw-input-*`. */
function inputShellTokensForFallback(fallbackInputMode: "light" | "dark"): {
  accent: string;
  restingBorder: string;
  hoverBorder: string;
  text: string;
  labelResting: string;
  optional: string;
  stepperResting: string;
  surface: string;
} {
  if (fallbackInputMode === "light") {
    return {
      accent: "rgba(0,0,0,0.85)",
      restingBorder: "rgba(0,0,0,0.28)",
      hoverBorder: "rgba(0,0,0,0.5)",
      text: "#111",
      labelResting: "rgba(0,0,0,0.85)",
      optional: "var(--inputOptional, rgba(89,89,89,0.62))",
      stepperResting: "rgba(0,0,0,0.75)",
      surface: "var(--inputLight, #e6e6e6)",
    };
  }
  return {
    accent: "rgba(255,255,255,0.95)",
    restingBorder: "rgba(255,255,255,0.22)",
    hoverBorder: "rgba(255,255,255,0.38)",
    text: "#fff",
    labelResting: "rgba(255,255,255,0.55)",
    optional: "var(--inputOptional, rgba(89,89,89,0.62))",
    stepperResting: "rgba(255,255,255,0.95)",
    surface: "var(--inputDark, #171717)",
  };
}

export default function Popmenu(props: PopmenuProps) {
  const {
    collapsed,
    extended,
    direction = "bottom-right",
    offset,
    s,
    confirmCollapsed,
    hoverIn,
    hoverOut,
    autofocus,
    mode = "normal",
    round,
    collapsedRound,
    extendedRound,
    shadow = true,
  } = props;
  const resolvedMode =
    mode === "auto" || mode === "normal" ? "dark" : mode;
  const fallbackInputMode = resolvedMode === "light" ? "dark" : "light";

  ensureBounceKeyframe();
  const open = state(false);
  /** Dimensioni naturali della barra di conferma (misurate fuori dal flusso). */
  const confW = state(0);
  const confH = state(0);
  const pressed = state(false);
  const confirming = state(false);
  /** Contatore di bounce: ogni trigger incrementa e fa ri-partire l'animazione anche se già in corso. */
  const bounceTick = state(0);
  let bounceTimer: number | undefined;
  const triggerBounce = () => {
    bounceTick(bounceTick() + 1);
    if (bounceTimer !== undefined) clearTimeout(bounceTimer);
    /** Durata animazione + margine, per resettare lo stato "in animazione". */
    bounceTimer = window.setTimeout(() => bounceTick(0), 420);
  };
  const cw = state(0);
  const ch = state(0);
  const ew = state(0);
  const eh = state(0);

  const dir = DIRS[direction];
  const closedPos = computeShellPosition(dir, {});
  const openPos = computeShellPosition(dir, offset ?? {});

  const reduced = prefersReducedMotion();

  const EASE_OPEN = "cubic-bezier(0.32, 0.72, 0, 1)";
  const EASE_CLOSE = "cubic-bezier(0.4, 0.0, 0.2, 1)";
  const D_OPEN = reduced ? 0 : 440;
  const D_CLOSE = reduced ? 0 : 280;

  const confirmOpts: ConfirmOptions = typeof confirmCollapsed === "object" && confirmCollapsed !== null ? confirmCollapsed : {};
  const confirmMessage = confirmOpts.message ?? "Conferma chiusura?";
  const confirmYes = confirmOpts.confirm ?? "Conferma";
  const confirmNo = confirmOpts.cancel ?? "Annulla";

  /** Elemento della shell per autofocus + outside-click affidabile cross-browser. */
  let shellEl: HTMLElement | null = null;

  /** Focus del primo input dentro la shell. Su iOS DEVE essere sincrono nel gesto utente. */
  const tryAutofocus = () => {
    if (!autofocus || !shellEl) return;
    const target = shellEl.querySelector<HTMLElement>("input, textarea, select, [contenteditable='true']");
    if (!target) return;
    /**
     * iOS Safari permette `.focus()` solo nello stesso tick del gesto utente.
     * Chiamata sincrona: sblocca la keyboard su iOS anche se l'elemento è ancora opacity:0.
     */
    target.focus({ preventScroll: true });
  };

  /** Tentativo di chiusura: se confirmCollapsed attivo, mostra la conferma. Altrimenti chiude subito. */
  const requestClose = () => {
    if (!open()) return;
    if (confirmCollapsed) {
      confirming(true);
    } else {
      open(false);
    }
  };

  const confirmCloseYes = (ev?: Event) => {
    ev?.stopPropagation();
    confirming(false);
    open(false);
  };
  const confirmCloseNo = (ev?: Event) => {
    ev?.stopPropagation();
    confirming(false);
  };

  const requestOpen = () => {
    if (open()) return;
    open(true);
    confirming(false);
    /** Focus immediato sincrono (iOS). Un secondo tentativo ritardato per desktop/Android. */
    tryAutofocus();
  };

  watch(() => {
    const inputOnThisPop = inputShellTokensForFallback(fallbackInputMode);
    const shellBg =
      resolvedMode === "light"
        ? "var(--popmenuLigth, var(--popmenuLight, #e6e6e6))"
        : "var(--popmenuDark, #171717)";
    logInputDebug(`[PopmenuThemeTrace]`, {
      open: open(),
      modeProp: mode,
      resolvedMode,
      fallbackInputMode,
      shellBackground: shellBg,
      colorSchemeOnShell: resolvedMode === "light" ? "light" : "dark",
      inputOnThisPop,
      note:
        "Se Form ha mode esplicito, resolvePalette usa la palette (dark/light) del form; " +
        "questi --fw-input-* valgono come fallback (mode `auto`/undefined) o dentro resolvePalette per mode 'normal'.",
      cssVarsInjectedOnShell: {
        "--fw-popmenu-bg": shellBg,
        "--fw-popmenu-mode": resolvedMode,
        "--fw-input-accent": inputOnThisPop.accent,
        "--fw-input-resting-border": inputOnThisPop.restingBorder,
        "--fw-input-hover-border": inputOnThisPop.hoverBorder,
        "--fw-input-text": inputOnThisPop.text,
        "--fw-input-label-resting": inputOnThisPop.labelResting,
        "--fw-input-optional": inputOnThisPop.optional,
        "--fw-input-stepper-resting": inputOnThisPop.stepperResting,
        "--fw-input-surface": inputOnThisPop.surface,
      },
    });
  });

  /**
   * Outside-click è gestito da un backdrop fullscreen (vedi JSX).
   * Qui non servono più listener globali: il backdrop è un elemento DOM reale che
   * intercetta click/tap su mobile/desktop in modo 100% affidabile.
   */

  /** ESC: se conferma aperta, la annulla; altrimenti richiede chiusura (può aprire la conferma). */
  watch(() => {
    if (!open()) return;
    const handler = (ev: KeyboardEvent) => {
      if (ev.key !== "Escape") return;
      if (confirming()) confirming(false);
      else requestClose();
    };
    document.addEventListener("keydown", handler);
    watch.onCleanup(() => document.removeEventListener("keydown", handler));
  });

  /** Autofocus ritardato (desktop/Android): secondo tentativo dopo il crossfade, per caret visibile. */
  watch(() => {
    if (!autofocus || !open() || !shellEl) return;
    const delay = Math.round(D_OPEN * 0.35);
    const id = window.setTimeout(() => {
      const active = document.activeElement as HTMLElement | null;
      /** Se il focus è già su un campo dentro la shell (es. da tryAutofocus sincrono), non reinterferire. */
      if (active && shellEl?.contains(active)) return;
      const target = shellEl?.querySelector<HTMLElement>("input, textarea, select, [contenteditable='true']");
      target?.focus({ preventScroll: true });
    }, delay);
    watch.onCleanup(() => clearTimeout(id));
  });

  const wrapStyle = () => ({
    position: "relative",
    display: "block",
    width: `${cw()}px`,
    height: `${ch()}px`,
  });

  const boxStyle = () => {
    const isOpen = open();
    const isConfirming = confirming();
    /**
     * Se la conferma è aperta, la shell si espande al max fra extended e conferma:
     * evita che pulsanti/testo vengano tagliati quando l'extended è piccolo.
     */
    const w = isOpen
      ? (isConfirming ? Math.max(ew(), confW()) : ew())
      : cw();
    const h = isOpen
      ? (isConfirming ? Math.max(eh(), confH()) : eh())
      : ch();
    const ready = w > 0 && h > 0;
    const pos = isOpen ? openPos : closedPos;
    const d = isOpen ? D_OPEN : D_CLOSE;
    const e = isOpen ? EASE_OPEN : EASE_CLOSE;
    const baseTransform = pos.transform ?? "";
    const pressScale = pressed() && !reduced ? "scale(0.97)" : "scale(1)";
    const composed = baseTransform ? `${baseTransform} ${pressScale}` : pressScale;
    const tick = bounceTick();
    /** Alterna fra due nomi di keyframe identici per riavviare l'animazione su ogni insistenza. */
    const bounceName = tick === 0 ? "none" : (tick % 2 === 1 ? "popmenu-bounce-a" : "popmenu-bounce-b");
    const shellBg =
      resolvedMode === "light"
        ? "var(--popmenuLigth, var(--popmenuLight, #e6e6e6))"
        : "var(--popmenuDark, #171717)";
    const shellRound =
      round !== undefined
        ? typeof round === "number"
          ? `${round}px`
          : round
        : "var(--popmenuRound, var(--round, 20px))";
    const closedRound =
      collapsedRound !== undefined
        ? typeof collapsedRound === "number"
          ? `${collapsedRound}px`
          : collapsedRound
        : shellRound;
    const openedRound =
      extendedRound !== undefined
        ? typeof extendedRound === "number"
          ? `${extendedRound}px`
          : extendedRound
        : shellRound;
    const activeRound = isOpen ? openedRound : closedRound;
    const shadowCfg = typeof shadow === "object" && shadow !== null ? shadow : {};
    const rootStyle =
      typeof document !== "undefined"
        ? getComputedStyle(document.documentElement)
        : null;
    const cssNum = (name: string, fallback: number): number => {
      const raw = rootStyle?.getPropertyValue(name) ?? "";
      const n = Number(raw);
      return Number.isFinite(n) ? n : fallback;
    };
    const sx = shadowCfg.x ?? cssNum("--popmenuShadowX", 0);
    const sy = shadowCfg.y ?? cssNum("--popmenuShadowY", 10);
    const sblur = shadowCfg.blur ?? cssNum("--popmenuShadowBlur", 26);
    const sspread = shadowCfg.spread ?? cssNum("--popmenuShadowSpread", 0);
    const scolor =
      shadowCfg.color ??
      (rootStyle?.getPropertyValue("--popmenuShadowColor").trim() ||
        "rgba(0, 0, 0, 0.35)");
    const cssIntensity = cssNum("--popmenuShadowIntensity", 1);
    const sintensity = shadowCfg.intensity ?? (Number.isFinite(cssIntensity) ? cssIntensity : 1);
    const cssOpacity = cssNum("--popmenuShadowOpacity", 1);
    const sopacity = shadowCfg.opacity ?? (Number.isFinite(cssOpacity) ? cssOpacity : 1);
    const shadowStrength = Math.max(0, sintensity * sopacity);
    const resolvedShadowColor = strengthenShadowColor(scolor, shadowStrength);
    const shellShadow =
      shadow === false || !isOpen
        ? "none"
        : `${sx}px ${sy}px ${sblur}px ${sspread}px ${resolvedShadowColor}`;
    const inputOnThisPop = inputShellTokensForFallback(fallbackInputMode);
    const st: Record<string, string> = {
      position: "absolute",
      width: `${w}px`,
      height: `${h}px`,
      cursor: "pointer",
      overflow: "hidden",
      opacity: ready ? "1" : "0",
      zIndex: isOpen ? "50" : "1",
      willChange: "width, height, transform, opacity",
      "--popmenu-base-transform": baseTransform || "none",
      transform: composed,
      transformOrigin: "center center",
      /**
       * `html`/`body` hanno `color-scheme: dark` (tema app). Se non lo
       * ristabiliamo qui, browser + UA style dei form restano in “dark
       * controls” e gli input in popmenu **chiari** possono sembrare scuri.
       */
      colorScheme: resolvedMode === "light" ? "light" : "dark",
      color: inputOnThisPop.text,
      background: shellBg,
      borderRadius: activeRound,
      boxShadow: shellShadow,
      "--fw-popmenu-bg": shellBg,
      "--fw-popmenu-mode": resolvedMode,
      "--fw-input-accent": inputOnThisPop.accent,
      "--fw-input-resting-border": inputOnThisPop.restingBorder,
      "--fw-input-hover-border": inputOnThisPop.hoverBorder,
      "--fw-input-text": inputOnThisPop.text,
      "--fw-input-label-resting": inputOnThisPop.labelResting,
      "--fw-input-optional": inputOnThisPop.optional,
      "--fw-input-stepper-resting": inputOnThisPop.stepperResting,
      "--fw-input-surface": inputOnThisPop.surface,
      animation: bounceName === "none" ? "none" : `${bounceName} 380ms cubic-bezier(0.25, 1.25, 0.5, 1) 1`,
      transition:
        `width ${d}ms ${e}, ` +
        `height ${d}ms ${e}, ` +
        `top ${d}ms ${e}, ` +
        `left ${d}ms ${e}, ` +
        `right ${d}ms ${e}, ` +
        `bottom ${d}ms ${e}, ` +
        `transform 180ms cubic-bezier(0.4, 0, 0.2, 1), ` +
        `opacity 180ms linear, ` +
        `border-radius 0s, background-color 0s, color 0s`,
    };
    if (pos.styles.top != null) st.top = pos.styles.top;
    if (pos.styles.bottom != null) st.bottom = pos.styles.bottom;
    if (pos.styles.left != null) st.left = pos.styles.left;
    if (pos.styles.right != null) st.right = pos.styles.right;
    return st;
  };

  const slotStyle = (w: () => number, h: () => number, visible: () => boolean) => (): Record<string, string> => {
    const isOpen = open();
    const d = isOpen ? D_OPEN : D_CLOSE;
    const inDelay = Math.round(d * 0.3);
    const outDur = Math.round(d * 0.22);
    const inDur = Math.round(d * 0.5);
    const vis = visible();
    const scaleVal = vis || reduced ? "1" : "0.96";
    const st: Record<string, string> = {
      position: "absolute",
      width: `${w()}px`,
      height: `${h()}px`,
      opacity: vis ? "1" : "0",
      transformOrigin: "center center",
      transition: vis
        ? `opacity ${inDur}ms cubic-bezier(0.2, 0.6, 0.2, 1) ${inDelay}ms, transform ${inDur}ms cubic-bezier(0.2, 0.6, 0.2, 1) ${inDelay}ms`
        : `opacity ${outDur}ms linear 0ms, transform ${outDur}ms cubic-bezier(0.4, 0, 0.2, 1) 0ms`,
      pointerEvents: vis ? "auto" : "none",
    };
    let tx = "0";
    let ty = "0";
    if (direction === "center" || dir.vx === 0) {
      st.left = "50%";
      tx = "-50%";
    } else if (dir.vx === 1) {
      st.left = "0";
    } else {
      st.right = "0";
    }
    if (direction === "center" || dir.vy === 0) {
      st.top = "50%";
      ty = "-50%";
    } else if (dir.vy === 1) {
      st.top = "0";
    } else {
      st.bottom = "0";
    }
    st.transform = `translate(${tx}, ${ty}) scale(${scaleVal})`;
    return st;
  };

  /**
   * Overlay conferma: action-sheet iOS-like. Patina scura + backdrop-filter blur
   * per offuscare il contenuto sottostante della shell. Layout "glassmorphism".
   */
  const confirmBarStyle = () => ({
    position: "absolute",
    inset: "0",
    display: "flex",
    flexDirection: "column",
    alignItems: "stretch",
    justifyContent: "center",
    paddingTop: "28px",
    paddingRight: "20px",
    paddingBottom: "24px",
    paddingLeft: "20px",
    boxSizing: "border-box",
    gap: "20px",
    background: "rgba(10, 10, 12, 0.48)",
    backdropFilter: "blur(14px) saturate(160%)",
    WebkitBackdropFilter: "blur(14px) saturate(160%)",
    color: "#fff",
    opacity: confirming() ? "1" : "0",
    transform: confirming() ? "translateY(0) scale(1)" : "translateY(6%) scale(0.98)",
    transition:
      "opacity 220ms cubic-bezier(0.2, 0.7, 0.2, 1), " +
      "transform 260ms cubic-bezier(0.2, 0.8, 0.2, 1)",
    pointerEvents: confirming() ? "auto" : "none",
    zIndex: "3",
  });

  const confirmMessageStyle: Record<string, string> = {
    flex: "1",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    fontWeight: "600",
    fontSize: "1.02em",
    lineHeight: "1.35",
    padding: "4px 6px",
    letterSpacing: "-0.01em",
    color: "#fff",
    textShadow: "0 1px 2px rgba(0,0,0,0.25)",
  };

  const confirmButtonsRowStyle: Record<string, string> = {
    display: "flex",
    gap: "10px",
  };

  const btnStyle = (variant: "yes" | "no"): Record<string, string> => ({
    flex: "1",
    padding: "14px 18px",
    borderRadius: "14px",
    cursor: "pointer",
    fontWeight: "600",
    fontSize: "0.95em",
    textAlign: "center",
    userSelect: "none",
    letterSpacing: "-0.005em",
    transition: "background-color 160ms ease, transform 140ms ease, box-shadow 160ms ease",
    background: variant === "yes"
      ? "linear-gradient(180deg, rgba(255,92,92,1) 0%, rgba(235,66,66,1) 100%)"
      : "rgba(255,255,255,0.18)",
    color: "#fff",
    boxShadow: variant === "yes"
      ? "0 6px 16px rgba(235,66,66,0.35), inset 0 1px 0 rgba(255,255,255,0.2)"
      : "inset 0 1px 0 rgba(255,255,255,0.12)",
    border: variant === "yes" ? "none" : "1px solid rgba(255,255,255,0.14)",
  });

  /**
   * Backdrop fullscreen: copre l'intera pagina quando il menu è aperto.
   * Cliccando sul backdrop → chiude (o mostra conferma se confirmCollapsed).
   * Se la conferma è già visibile, il backdrop la annulla (UX safe).
   * Funziona al 100% su iOS, Android, desktop — nessun listener globale.
   */
  const backdropStyle = () => ({
    position: "fixed",
    inset: "0",
    background: "transparent",
    zIndex: "40",
    pointerEvents: open() ? "auto" : "none",
    /** touch-action: manipulation evita che iOS ritardi il click di 300ms. */
    touchAction: "manipulation",
    /** -webkit-tap-highlight per togliere l'highlight blu su tap iOS. */
    WebkitTapHighlightColor: "transparent",
  });

  const onBackdropTap = (ev: Event) => {
    ev.stopPropagation();
    if (confirming()) {
      /** Insistenza su tap-fuori con conferma attiva: feedback visivo sulla shell. */
      triggerBounce();
      return;
    }
    requestClose();
  };

  /**
   * Press scale: scatta per il tap sulla shell/collapsed, ma NON se il tap parte
   * da un elemento interattivo INTERNO (input, textarea, select, button,
   * [contenteditable], [role=button], o qualsiasi elemento con `click` registrato
   * dal framework → `[data-fw-click]`). La shell stessa ha `click={...}` e quindi
   * ha `data-fw-click`: la escludiamo esplicitamente dal match.
   */
  const INTERACTIVE_SELECTOR =
    "input, textarea, select, button, [contenteditable='true'], [role='button'], [data-fw-click]";
  const onPressDown = (ev: Event) => {
    const target = ev.target as Element | null;
    if (target && target.closest) {
      const hit = target.closest(INTERACTIVE_SELECTOR) as HTMLElement | null;
      /** Se il primo ancestor interattivo è la shell stessa, va bene: press-scale ok. */
      if (hit && hit !== shellEl) return;
    }
    pressed(true);
  };
  const onPressUp = () => pressed(false);
  const onMouseEnter = () => {
    if (hoverIn) requestOpen();
  };
  const onMouseLeave = () => {
    pressed(false);
    /** hoverOut chiude senza conferma (sarebbe UX fastidiosa). */
    if (hoverOut && open()) open(false);
  };

  /**
   * Factory per il contenuto della conferma (messaggio + pulsanti) usato sia nel
   * measure host (per misurare dimensione naturale) sia nell'overlay renderizzato.
   */
  const renderConfirmContent = () => (
    <>
      <div style={confirmMessageStyle as any}>{confirmMessage}</div>
      <div style={confirmButtonsRowStyle as any}>
        <div style={btnStyle("no") as any}>{confirmNo}</div>
        <div style={btnStyle("yes") as any}>{confirmYes}</div>
      </div>
    </>
  );

  /**
   * Stile del measure host della conferma: replica il layout dell'overlay
   * (flex-column + gap + padding) ma dimensione `max-content` per misurare la size naturale.
   */
  const confirmMeasureHostStyle: Record<string, string> = {
    ...measureHostStyle,
    display: "flex",
    flexDirection: "column",
    gap: "20px",
    paddingTop: "28px",
    paddingRight: "20px",
    paddingBottom: "24px",
    paddingLeft: "20px",
    boxSizing: "border-box",
    /** Un minWidth aiuta i pulsanti flex:1 ad avere una size "realistica" quando misurati. */
    minWidth: "240px",
  };

  return (
    <div style={wrapStyle as any}>
      <div ref={observeSize(cw, ch)} style={measureHostStyle as any}>
        {collapsed()}
      </div>
      <div ref={observeSize(ew, eh)} style={measureHostStyle as any}>
        {extended()}
      </div>
      {/* Measure host per la conferma: calcola la size naturale richiesta dall'overlay. */}
      {confirmCollapsed ? (
        <div ref={observeSize(confW, confH)} style={confirmMeasureHostStyle as any}>
          {renderConfirmContent()}
        </div>
      ) : null}

      {/* Backdrop fullscreen: intercetta click fuori dalla shell in modo affidabile (mobile + desktop). */}
      <div
        style={backdropStyle as any}
        click={onBackdropTap}
      />

      <div
        ref={(el) => {
          shellEl = el as HTMLElement | null;
        }}
        s={s as any}
        style={boxStyle as any}
        click={() => {
          if (!open()) requestOpen();
        }}
        mousedown={onPressDown}
        mouseup={onPressUp}
        mouseenter={onMouseEnter}
        mouseleave={onMouseLeave}
        touchstart={onPressDown}
        touchend={onPressUp}
      >
        <div style={slotStyle(cw, ch, () => !open()) as any}>{collapsed()}</div>
        <div style={slotStyle(ew, eh, () => open()) as any}>{extended()}</div>

        {/* Overlay conferma: action-sheet iOS-like sopra il contenuto (blur + patina scura) */}
        <div
          style={confirmBarStyle as any}
          click={(ev: Event) => ev.stopPropagation()}
        >
          <div style={confirmMessageStyle as any}>{confirmMessage}</div>
          <div style={confirmButtonsRowStyle as any}>
            <div style={btnStyle("no") as any} click={confirmCloseNo}>
              {confirmNo}
            </div>
            <div style={btnStyle("yes") as any} click={confirmCloseYes}>
              {confirmYes}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}