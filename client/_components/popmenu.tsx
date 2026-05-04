import { device, state, watch } from "client";
import { toNodes } from "../../core/client/runtime/logic/children";
import { onNodeDispose, replaceChildrenWithDispose } from "../../core/client/runtime/logic/lifecycle";
import { clientConfig } from "../config";
import { INPUT_DEBUG, logInputDebug } from "./input/inputDebug";

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
  /** Dopo conferma (overlay Sì). */
  onConfirm?: () => void;
  /** Dopo annulla (overlay No), solo per `confirmCollapsed` / guardia chiusura. */
  onCancel?: () => void;
}

/** Esito RPC / form: patina verde o rossa come l’overlay conferma. */
export type PopmenuFeedback = {
  kind: "error" | "success";
  message: string;
  title?: string;
  /** Default `true`: pulsante per tornare al contenuto sotto. */
  showDismissButton?: boolean;
  /** Testo pulsante dismiss. Default "Back" (error) / "OK" (success). */
  dismissLabel?: string;
};

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
  /**
   * Token `s` sul **solo** wrapper attorno a `collapsed` (non sull’intera shell).
   * Default: `p-2 text-secondary scale-110`. Passa `false` per disattivare (resta l’allineamento interno).
   * Il nome `hover` nel framework indica l’`HoverProp` (mouse enter/leave) sui tag DOM, non i token;
   * qui si usa `collapsedS` per evitare ambiguità. `hover` resta alias deprecato.
   *
   * Il wrapper interno **riempie** lo slot chiuso (`cw×ch`, come la shell): `bg-*` / gradient su
   * `collapsedS` coprono tutto il rettangolo come con `mode` light/dark (niente alone del tema ai bordi).
   * Per la sola shell trasparente (icona “floating”) usa `collapsedShellS` / `s` sulla shell.
   */
  collapsedS?: unknown | false;
  /**
   * Token `s` applicati alla **shell** solo con menu chiuso (es. `bg-transparent`, `text-#030303`).
   * Aperto si torna al tema inline di `boxStyle` come senza `s`. Ignorato se passi già `s` sulla shell.
   */
  collapsedShellS?: unknown;
  /** @deprecated Usa `collapsedS` (i token stile sul wrapper del collapsed). */
  hover?: unknown;
  /** Se `true` (o oggetto con opzioni), chiede conferma prima di chiudere (clickout / esc). */
  confirmCollapsed?: boolean | ConfirmOptions;
  /** Apre quando il mouse entra sulla shell. Su viewport `mob`/`tab` è ignorato (solo `des`). */
  hoverIn?: boolean;
  /**
   * Chiude quando il mouse esce dalla shell (incluso il contenuto). Su `mob`/`tab` è ignorato.
   * Può essere `boolean` oppure un getter / `Signal` (`state`): viene letto ad ogni `mouseleave`.
   * Se passi `state(...)` senza questa logica, la funzione-Signal è sempre truthy e chiude sempre.
   */
  hoverOut?: boolean | (() => boolean);
  /** Al primo `open=true`, mette focus sul primo input/textarea dentro l'extended. */
  autofocus?: boolean;
  /**
   * Modalità cromatica della shell. Default `dark`.
   * - `light` / `dark`: tinta unita tema (come prima).
   * - `liquidGlassDark`: interno scuro uniforme; luci agli angoli (inset chiare top-left / bottom-right).
   * - `liquidGlassLight`: pannello **grigio‑chiaro** (non bianco puro) + bordo scuro + ombre così
   *   volume e angoli restano leggibili anche su sfondo nero o bianco.
   * Per entrambe: raggio default `12px` se non passi `round`.
   */
  mode?: "light" | "dark" | "liquidGlassDark" | "liquidGlassLight";
  /** Raggio angoli shell. Default globale: `var(--round)`. */
  round?: number | string;
  /** Raggio shell quando il popmenu è chiuso (solo collapsed). */
  collapsedRound?: number | string;
  /** Raggio shell quando il popmenu è aperto (solo extended). */
  extendedRound?: number | string;
  /**
   * Ombra della shell quando è aperta. Default `true`.
   * - `true`: se `:root` ha `--popmenuShadow` non vuota → `box-shadow: var(--popmenuShadow)`.
   *   Consiglio in CSS: `--popmenuShadowColor` + `--popmenuShadowBlur` (e opz. X/Y/spread), poi
   *   `--popmenuShadow: 0 var(--popmenuShadowY) var(--popmenuShadowBlur) var(--popmenuShadowSpread) var(--popmenuShadowColor)`.
   *   Se `--popmenuShadow` è vuota, compone da `--popmenuShadowX|Y|Blur|Spread|Color` (numeri con o senza `px`) + intensità/opacità.
   * - oggetto: override numerici/colore (come i token, senza usare la one-liner).
   * - `false`: nessuna ombra.
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
  /** Se valorizzato, overlay verde (`success`) o rosso (`error`) sopra il contenuto. */
  feedback?: () => PopmenuFeedback | null | undefined;
  /** Tap backdrop, ESC, pulsante dismiss: azzera il feedback lato parent. */
  onFeedbackDismiss?: () => void;
  /** Cambia valore (numero o boolean) per chiudere menu, conferma e feedback. */
  closePulse?: () => number | boolean;
  /** Dopo chiusura menu (invocato insieme a `open(false)` nei percorsi reali; niente `watch` su `open` per non interferire col layout). */
  onClose?: () => void;
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
    return () => {
      ro.disconnect();
    };
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

/**
 * Wrapper `collapsed`: niente altezze/larghezze in % (su mobile bloccavano il padding verticale
 * su `<icon>` / `collapsedS`). Flex centra nel box misurato; `lineHeight: 0` evita striscia sotto le SVG.
 * Per `bg-*` a tutta area: usa token `w-100%` / `min-h-100%` su `collapsedS` se ti serve.
 */
const collapsedSlotAlignStyle: Record<string, string> = {
  boxSizing: "border-box",
  lineHeight: "0",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

/** Default stile del wrapper `collapsed` (icona+padding; scalabile; colore testo/icone). */
const DEFAULT_COLLAPSED_WRAPPER_S = "p-2 text-secondary scale-110";

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

let fwPopmenuPortal: HTMLDivElement | null = null;

/** Layer sotto `body` (dopo `#root`): evita stacking context di genitori (`transform`, `#root` isolation, …). */
function ensureFwPopmenuPortal(): HTMLDivElement {
  if (fwPopmenuPortal && document.body.contains(fwPopmenuPortal)) {
    return fwPopmenuPortal;
  }
  const el = document.createElement("div");
  el.id = "fw-popmenu-portal";
  el.setAttribute("data-fw", "popmenu-portal");
  document.body.appendChild(el);
  fwPopmenuPortal = el;
  return el;
}

export default function Popmenu(props: PopmenuProps) {
  const {
    collapsed,
    extended,
    direction = "bottom-right",
    offset,
    s,
    collapsedS,
    collapsedShellS,
    hover: legacyCollapsedWrapperHover,
    confirmCollapsed,
    feedback,
    onFeedbackDismiss,
    closePulse,
    onClose,
    hoverIn,
    hoverOut,
    autofocus,
    mode = "dark",
    round,
    collapsedRound,
    extendedRound,
    shadow = true,
  } = props;

  const wrapperCollapsedS: false | unknown =
    collapsedS === false
      ? false
      : (collapsedS ?? legacyCollapsedWrapperHover ?? DEFAULT_COLLAPSED_WRAPPER_S);

  const hasCollapsedShellS =
    collapsedShellS != null &&
    collapsedShellS !== false &&
    !(typeof collapsedShellS === "string" && collapsedShellS.trim() === "");

  /** `s` shell: se il parent non passa `s`, con menu chiuso si possono applicare token (es. `bg-transparent`). */
  const shellS: unknown =
    s != null && s !== false
      ? s
      : hasCollapsedShellS
        ? () => (open() ? false : collapsedShellS)
        : s;

  const isLiquidGlassDark = mode === "liquidGlassDark";
  const isLiquidGlassLight = mode === "liquidGlassLight";
  const isLiquidGlass = isLiquidGlassDark || isLiquidGlassLight;

  ensureBounceKeyframe();
  const open = state(false);
  /** Dimensioni naturali della barra di conferma (misurate fuori dal flusso). */
  const confW = state(0);
  const confH = state(0);
  const feedW = state(0);
  const feedH = state(0);
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

  const readFeedback = (): PopmenuFeedback | null => {
    const f = feedback?.();
    if (f == null) return null;
    if (!f.message && !f.title) return null;
    return f;
  };

  const feedbackActive = (): boolean => readFeedback() != null;

  const confirmMeasureCopy = (): { msg: string; yes: string; no: string } => ({
    msg: confirmMessage,
    yes: confirmYes,
    no: confirmNo,
  });

  let lastClosePulse: number | boolean | undefined = undefined;
  watch(
    () => {
      const v = closePulse?.();
      if (v === undefined) return;
      if (Object.is(v, lastClosePulse)) return;
      lastClosePulse = v;
      const wasOpen = open();
      open(false);
      confirming(false);
      onFeedbackDismiss?.();
      if (wasOpen) onClose?.();
    },
    { watch: [() => closePulse?.()] },
  );

  /** Elemento della shell per autofocus + outside-click affidabile cross-browser. */
  let shellEl: HTMLElement | null = null;

  /** Root del Popmenu: aperto → spostata in `#fw-popmenu-portal` + `position:fixed` ancorata al placeholder. */
  let wrapEl: HTMLDivElement | null = null;
  let layoutPlaceholder: HTMLDivElement | null = null;
  /** Cleanup listener `visualViewport` (viewport mobile Safari/Chrome vs layout). */
  let detachVisualViewportPin: (() => void) | undefined;
  /**
   * `true` mentre il wrap è fisicamente nel portal (anche durante la transizione di chiusura).
   * Serve per decidere `position: fixed` vs `relative` nel `wrapStyle`: commutare durante la chiusura
   * interromperebbe la transizione CSS della shell → chiusura "netta".
   */
  const portalMounted = state(false);
  /** Coordinate viewport del placeholder (non usare `state({...})`: `state` da `client` è lo store root → oggetto = StateMap, non Signal). */
  const wrapPinLeft = state(0);
  const wrapPinTop = state(0);

  /**
   * Se il placeholder non è più nel documento (es. riga eliminata mentre il menu è in chiusura nel portal),
   * `getBoundingClientRect()` può dare (0,0) e la shell “salta” in alto a sinistra: smontiamo subito il portal.
   */
  const syncWrapPin = () => {
    if (!layoutPlaceholder) return;
    if (!layoutPlaceholder.isConnected) {
      cancelPendingTeardown();
      teardownPortal();
      return;
    }
    const r = layoutPlaceholder.getBoundingClientRect();
    wrapPinLeft(r.left);
    wrapPinTop(r.top);
  };

  /** Riallinea il wrap al placeholder (stesso punto del trigger nel documento). */
  const onScrollOrResizePin = () => {
    syncWrapPin();
  };

  /**
   * Barra UI che ridimensiona il “visual viewport” su mobile: senza questo il `fixed` agganciato
   * col pin del placeholder resta sfasato verticalmente vs il trigger (extended “troppo in alto”).
   */
  function attachVisualViewportPin(onPin: () => void): (() => void) | undefined {
    if (typeof window === "undefined" || window.visualViewport == null) return undefined;
    const vv = window.visualViewport;
    onPin();
    vv.addEventListener("resize", onPin);
    vv.addEventListener("scroll", onPin);
    return () => {
      vv.removeEventListener("resize", onPin);
      vv.removeEventListener("scroll", onPin);
    };
  }

  const teardownPortal = () => {
    detachVisualViewportPin?.();
    detachVisualViewportPin = undefined;
    window.removeEventListener("scroll", onScrollOrResizePin, true);
    window.removeEventListener("resize", onScrollOrResizePin);
    const wrap = wrapEl;
    const ph = layoutPlaceholder;
    if (!ph) {
      if (wrap && fwPopmenuPortal && wrap.parentElement === fwPopmenuPortal) {
        fwPopmenuPortal.removeChild(wrap);
      }
      portalMounted(false);
      return;
    }
    const parent = ph.parentElement;
    if (wrap && fwPopmenuPortal && wrap.parentElement === fwPopmenuPortal) {
      fwPopmenuPortal.removeChild(wrap);
      if (parent) parent.insertBefore(wrap, ph);
    }
    ph.remove();
    layoutPlaceholder = null;
    portalMounted(false);
  };

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
  const nowMs = (): number => (typeof performance !== "undefined" ? performance.now() : Date.now());
  /**
   * Dopo l’apertura (Popmenu annidato, wrap spostato in portal, o `mouseup` che finisce sul
   * backdrop) il `click` può colpire il backdrop a fine gesto. Ignoriamo le chiusure su backdrop
   * per qualche decina di millisecondi: evita "clicco e si chiude subito" senza bloccare
   * una seconda chiusura intenzionale (tap fuori subito dopo).
   */
  let ignoreBackdropCloseUntilMs = 0;
  const BACKDROP_CLOSE_GRACE_MS = 300;

  const requestClose = () => {
    if (!open()) return;
    if (feedbackActive()) {
      onFeedbackDismiss?.();
      return;
    }
    if (confirmCollapsed) {
      confirming(true);
    } else {
      open(false);
      onClose?.();
    }
  };

  const confirmCloseYes = (ev?: Event) => {
    ev?.stopPropagation();
    confirmOpts.onConfirm?.();
    confirming(false);
    open(false);
    onClose?.();
  };
  const confirmCloseNo = (ev?: Event) => {
    ev?.stopPropagation();
    confirmOpts.onCancel?.();
    confirming(false);
  };

  const requestOpen = () => {
    if (open()) return;
    open(true);
    ignoreBackdropCloseUntilMs = nowMs() + BACKDROP_CLOSE_GRACE_MS;
    confirming(false);
    /** Focus immediato sincrono (iOS). Un secondo tentativo ritardato per desktop/Android. */
    tryAutofocus();
  };

  if (INPUT_DEBUG) watch(() => {
    const colorSchemeLightTrace =
      mode === "liquidGlassLight" || (mode === "light" && !isLiquidGlass);
    const shellBgTrace =
      isLiquidGlassDark
        ? "liquidGlassDark (solid + corner highlights)"
        : isLiquidGlassLight
          ? "liquidGlassLight (gray gradient + rim/shadow stack)"
          : mode === "light"
            ? "var(--popmenu-surface-contrast, #e6e6e6)"
            : "var(--popmenu-surface, #171717)";
    logInputDebug(`[PopmenuThemeTrace]`, {
      open: open(),
      modeProp: mode,
      isLiquidGlass,
      isLiquidGlassDark,
      isLiquidGlassLight,
      shellBackground: shellBgTrace,
      colorSchemeOnShell: colorSchemeLightTrace ? "light" : "dark",
      note:
        "Input: temi con Form/Input o formModeShellScopeVars; la shell popmenu non inietta --fw-input-*.",
      cssVarsInjectedOnShell: {
        "--fw-popmenu-bg": shellBgTrace,
        "--fw-popmenu-mode": mode,
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
      if (feedbackActive()) {
        onFeedbackDismiss?.();
        return;
      }
      if (confirming()) confirming(false);
      else requestClose();
    };
    document.addEventListener("keydown", handler);
    watch.onCleanup(() => document.removeEventListener("keydown", handler));
  });

  /** Autofocus ritardato (desktop/Android): secondo tentativo dopo il crossfade, per caret visibile. */
  watch(() => {
    if (!autofocus || !open() || !shellEl || confirming() || feedbackActive()) return;
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

  /**
   * Con `open`, il wrap è nel portal sotto `body`: coordinate viewport dal placeholder lasciato al posto del trigger.
   * `watch` vincolato solo a `open` per non smontare il portal a ogni tick di `cw`/`ch`.
   *
   * CRITICO per l’animazione di chiusura:
   * Spostare `wrap` via `appendChild` / `insertBefore` **interrompe tutte le transizioni CSS in corso**
   * (il browser tratta il nodo come appena ri-connesso e resetta gli stili transitioned → su mobile è ancora
   * più aggressivo, niente fade/resize). Quindi a `open=false` NON smontiamo il portal subito: lasciamo
   * che la transizione di `boxStyle` finisca (`D_CLOSE` + piccolo margine) e solo dopo rimettiamo il wrap
   * inline. Se riapre nel frattempo, il timer viene annullato e il nodo resta nel portal.
   */
  let pendingTeardownTimer: number | undefined;
  const cancelPendingTeardown = () => {
    if (pendingTeardownTimer !== undefined) {
      clearTimeout(pendingTeardownTimer);
      pendingTeardownTimer = undefined;
    }
  };

  watch(
    () => {
      const wrap = wrapEl;
      if (!wrap) return;

      let disposerSize: (() => void) | null = null;
      watch.onCleanup(() => {
        detachVisualViewportPin?.();
        detachVisualViewportPin = undefined;
        window.removeEventListener("scroll", onScrollOrResizePin, true);
        window.removeEventListener("resize", onScrollOrResizePin);
        disposerSize?.();
        disposerSize = null;
        /**
         * Ritardo = durata massima osservata in `boxStyle` + margine: `D_CLOSE` per width/height/top/left/…,
         * e 180ms per opacity/transform. Prendiamo `D_CLOSE + 60ms`.
         */
        cancelPendingTeardown();
        if (reduced) {
          teardownPortal();
        } else {
          pendingTeardownTimer = window.setTimeout(() => {
            pendingTeardownTimer = undefined;
            teardownPortal();
          }, D_CLOSE + 60);
        }
      });

      if (!open()) return;

      cancelPendingTeardown();

      const portal = ensureFwPopmenuPortal();
      if (wrap.parentElement !== portal) {
        const parent = wrap.parentElement;
        if (!parent) return;
        const ph = document.createElement("div");
        ph.style.display = "inline-block";
        ph.style.verticalAlign = "middle";
        ph.setAttribute("aria-hidden", "true");
        parent.insertBefore(ph, wrap);
        layoutPlaceholder = ph;
        portal.appendChild(wrap);
        portalMounted(true);
      } else {
        portalMounted(true);
      }

      disposerSize = watch(() => {
        if (!layoutPlaceholder) return;
        if (!layoutPlaceholder.isConnected) {
          cancelPendingTeardown();
          teardownPortal();
          return;
        }
        layoutPlaceholder.style.width = `${cw()}px`;
        layoutPlaceholder.style.height = `${ch()}px`;
        syncWrapPin();
      });

      detachVisualViewportPin?.();
      detachVisualViewportPin = attachVisualViewportPin(syncWrapPin);

      window.addEventListener("scroll", onScrollOrResizePin, true);
      window.addEventListener("resize", onScrollOrResizePin);
      syncWrapPin();
      requestAnimationFrame(syncWrapPin);
    },
    { watch: [() => open()] },
  );

  const wrapStyle = () => {
    /**
     * Il wrap è fissato (position:fixed, ancorato al placeholder) finché è nel portal — anche durante
     * l’animazione di chiusura, altrimenti il cambio position interrompe la transizione CSS della shell.
     * `transition: none` su left/top: allo scroll il pin si aggiorna ogni frame senza “scivolare” verso
     * il trigger (resta agganciato al punto d’apertura nel layout, ma senza transizione sul contenitore).
     */
    const inPortal = portalMounted();
    return {
      position: inPortal ? ("fixed" as const) : ("relative" as const),
      ...(inPortal
        ? {
            left: `${wrapPinLeft()}px`,
            top: `${wrapPinTop()}px`,
            transition: "none",
          }
        : {}),
      display: "block",
      width: `${cw()}px`,
      height: `${ch()}px`,
    };
  };

  const boxStyle = () => {
    const isOpen = open();
    const isConfirming = confirming();
    const isFb = feedbackActive();
    /**
     * Se la conferma è aperta, la shell si espande al max fra extended e conferma:
     * evita che pulsanti/testo vengano tagliati quando l'extended è piccolo.
     */
    const w = isOpen
      ? Math.max(ew(), isConfirming ? confW() : 0, isFb ? feedW() : 0)
      : cw();
    const h = isOpen
      ? Math.max(eh(), isConfirming ? confH() : 0, isFb ? feedH() : 0)
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
    const shellBgFlat =
      mode === "light"
        ? "var(--popmenu-surface-contrast, #e6e6e6)"
        : "var(--popmenu-surface, #171717)";
    let shellRound: string;
    if (round !== undefined) {
      shellRound = typeof round === "number" ? `${round}px` : round;
    } else if (isLiquidGlass) {
      /** Leggermente più arrotondato del tema “squadrato”; sovrascrivibile con `round` / `*Round`. */
      shellRound = "12px";
    } else {
      shellRound = "var(--popmenuRound, var(--round, 20px))";
    }
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
    const shadowObj = typeof shadow === "object" && shadow !== null ? shadow : null;
    const shadowCfg = shadowObj ?? {};
    const rootStyle =
      typeof document !== "undefined"
        ? getComputedStyle(document.documentElement)
        : null;
    const cssNum = (name: string, fallback: number): number => {
      const raw = rootStyle?.getPropertyValue(name) ?? "";
      const n = Number(raw);
      return Number.isFinite(n) ? n : fallback;
    };
    /** Lunghezze in px da token CSS (`42` o `42px`). */
    const cssPx = (name: string, fallback: number): number => {
      const raw = (rootStyle?.getPropertyValue(name) ?? "").trim();
      if (!raw) return fallback;
      const n = parseFloat(raw);
      return Number.isFinite(n) ? n : fallback;
    };
    const popmenuShadowOneLine = (rootStyle?.getPropertyValue("--popmenuShadow") ?? "").trim();

    const composedShadowFromTokens = (): string => {
      const sx = shadowCfg.x ?? cssPx("--popmenuShadowX", 0);
      const sy = shadowCfg.y ?? cssPx("--popmenuShadowY", 10);
      const sblur = shadowCfg.blur ?? cssPx("--popmenuShadowBlur", 42);
      const sspread = shadowCfg.spread ?? cssPx("--popmenuShadowSpread", -6);
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
      return `${sx}px ${sy}px ${sblur}px ${sspread}px ${resolvedShadowColor}`;
    };

    let shellShadow: string;
    if (shadow === false || !isOpen) {
      shellShadow = "none";
    } else if (shadowObj) {
      shellShadow = composedShadowFromTokens();
    } else if (popmenuShadowOneLine !== "") {
      shellShadow = "var(--popmenuShadow)";
    } else {
      shellShadow = composedShadowFromTokens();
    }
    /** Dark: luci inset chiare agli angoli. Light: ombra esterna + bevel + luci inset su base grigia. */
    const liquidGlassRimDark =
      "inset 3px 3px 5px -3px rgba(255,255,255,0.16), inset -3px -3px 5px -3px rgba(255,255,255,0.1)";
    const liquidGlassRimLight =
      "0 6px 20px rgba(0,0,0,0.28), " +
      "0 0 0 1px rgba(255,255,255,0.5), " +
      "inset 0 0 0 1px rgba(0,0,0,0.14), " +
      "inset 1px 1px 0 0 rgba(255,255,255,0.5), " +
      "inset -1px -1px 0 0 rgba(0,0,0,0.14), " +
      "inset 6px 6px 14px -6px rgba(255,255,255,0.12), " +
      "inset -6px -6px 14px -6px rgba(0,0,0,0.1)";
    const liquidGlassRim = isLiquidGlassLight ? liquidGlassRimLight : liquidGlassRimDark;
    if (isLiquidGlass) {
      shellShadow = shellShadow === "none" ? liquidGlassRim : `${shellShadow}, ${liquidGlassRim}`;
    }
    const colorSchemeLight =
      mode === "liquidGlassLight" || (mode === "light" && !isLiquidGlass);
    const shellTextColor = colorSchemeLight ? "#111" : "rgba(255,255,255,0.95)";
    /** Se la shell passa `s=…`, o `collapsedShellS` vale solo da chiuso: `applyStyle` gestisce bg/color. */
    const shellThemeFromS =
      (s != null && s !== false) || (hasCollapsedShellS && !isOpen);
    const st: Record<string, string> = {
      position: "absolute",
      width: `${w}px`,
      height: `${h}px`,
      cursor: "pointer",
      overflow: "hidden",
      /**
       * Compositing `transform` + `border-radius` + `overflow:hidden` può lasciare un alone chiaro
       * agli angoli (subpixel / layer). `backface-visibility` + `isolation` stabilizzano la pittura.
       */
      backfaceVisibility: "hidden",
      WebkitBackfaceVisibility: "hidden",
      isolation: "isolate",
      opacity: ready ? "1" : "0",
      /* Opacità 0 ma rettangolo ancora “hit” → niente click-through: il tap passa al backdrop. */
      pointerEvents: ready ? "auto" : "none",
      zIndex: isOpen ? "var(--fw-z-popmenu-shell, 100002)" : "1",
      willChange: "width, height, transform, opacity",
      "--popmenu-base-transform": baseTransform || "none",
      transform: composed,
      transformOrigin: "center center",
      /**
       * `html`/`body` hanno `color-scheme: dark` (tema app). Se non lo
       * ristabiliamo qui, browser + UA style dei form restano in “dark
       * controls” e gli input in popmenu **chiari** possono sembrare scuri.
       */
      colorScheme: colorSchemeLight ? "light" : "dark",
      borderRadius: activeRound,
      boxShadow: shellShadow,
      "--fw-popmenu-mode": mode,
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
        `border-radius 0s, background-color 0s, color 0s, ` +
        `box-shadow ${d}ms ${e}`,
    };
    if (!shellThemeFromS) {
      st.color = shellTextColor;
      if (isLiquidGlassDark) {
        st.background = "rgb(10, 10, 12)";
        st["--fw-popmenu-bg"] = "rgb(10, 10, 12)";
      } else if (isLiquidGlassLight) {
        /** Grigio‑chiaro freddo: contrasto reale con highlight bianchi e ombre. */
        st.background = "linear-gradient(165deg, rgb(222, 226, 234) 0%, rgb(198, 202, 214) 100%)";
        st["--fw-popmenu-bg"] = "rgb(208, 212, 222)";
      } else {
        st.background = shellBgFlat;
        st["--fw-popmenu-bg"] = shellBgFlat;
      }
    }
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
    /**
     * Chiusura menu (open = false, slot extended che scompare): stessa ordine di grandezza di D_CLOSE per
     * opacity/transform dello slot, altrimenti ~0,22*D = ~62ms con D_CLOSE=280 e il body sparisce mentre la
     * shell restringe ancora per 280ms — effetto "taglio" brusco, evidente su pannelli piccoli. Con feedback
     * sopra l’extended (ancora open) resta lo scarto breve 0,22*D_OPEN.
     */
    const outDur = isOpen ? Math.round(d * 0.22) : d;
    const inDur = Math.round(d * 0.5);
    const vis = visible();
    const scaleVal = vis || reduced ? "1" : "0.96";
    const st: Record<string, string> = {
      position: "absolute",
      zIndex: "0",
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
    /** Stesso raggio della shell: evita micro-gap fra clip arrotondato e contenuto con `transform`. */
    st.borderRadius = "inherit";
    return st;
  };

  /**
   * Overlay conferma: action-sheet iOS-like. Patina scura + backdrop-filter blur
   * per offuscare il contenuto sottostante della shell. Layout "glassmorphism".
   */
  const confirmBarStyle = () => ({
    position: "absolute",
    inset: "0",
    borderRadius: "inherit",
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
    opacity: confirming() && !feedbackActive() ? "1" : "0",
    transform:
      confirming() && !feedbackActive() ? "translateY(0) scale(1)" : "translateY(6%) scale(0.98)",
    transition:
      "opacity 220ms cubic-bezier(0.2, 0.7, 0.2, 1), " +
      "transform 260ms cubic-bezier(0.2, 0.8, 0.2, 1)",
    pointerEvents: confirming() && !feedbackActive() ? "auto" : "none",
    zIndex: "4",
  });

  /** Pannello feedback a tinta unita (verde / rosso): tutto il contenuto in bianco sopra. */
  const feedbackBarStyle = () => {
    const f = readFeedback();
    const active = f != null;
    const bg =
      !active ? "#16a34a" : f.kind === "success" ? "#16a34a" : "#dc2626";
    return {
      position: "absolute" as const,
      inset: "0",
      borderRadius: "inherit",
      display: "flex",
      flexDirection: "column" as const,
      alignItems: "stretch",
      justifyContent: "flex-start",
      paddingTop: "28px",
      paddingRight: "20px",
      paddingBottom: "24px",
      paddingLeft: "20px",
      boxSizing: "border-box" as const,
      gap: "16px",
      background: bg,
      color: "#fff",
      opacity: active ? "1" : "0",
      transform: active ? "translateY(0) scale(1)" : "translateY(6%) scale(0.98)",
      transition:
        "opacity 220ms cubic-bezier(0.2, 0.7, 0.2, 1), " +
        "transform 260ms cubic-bezier(0.2, 0.8, 0.2, 1)",
      pointerEvents: active ? "auto" : "none",
      zIndex: "5",
      isolation: "isolate",
    };
  };

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

  const feedbackMsgStyle: Record<string, string> = {
    flex: "0 0 auto",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    fontWeight: "500",
    fontSize: "0.95em",
    lineHeight: "1.4",
    padding: "4px 6px",
    color: "#fff",
  };

  /** Fila azioni in fondo al pannello feedback (altezza shell fissata da `inset: 0`). */
  const feedbackFooterRowStyle: Record<string, string> = {
    display: "flex",
    width: "100%",
    marginTop: "auto",
    flexShrink: "0",
    boxSizing: "border-box",
  };

  const feedbackDismissBtnStyle: Record<string, string> = {
    width: "100%",
    boxSizing: "border-box",
    padding: "14px 20px",
    borderRadius: "14px",
    cursor: "pointer",
    fontWeight: "600",
    fontSize: "0.95em",
    textAlign: "left",
    userSelect: "none",
    letterSpacing: "-0.005em",
    color: "#fff",
    background: "rgba(255,255,255,0.22)",
    border: "2px solid #fff",
    boxShadow: "none",
  };

  const feedbackIconRowStyle: Record<string, string> = {
    flex: "0 0 auto",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    lineHeight: "0",
    minHeight: "3.25rem",
  };

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
    zIndex: "var(--fw-z-popmenu-backdrop, 100001)",
    pointerEvents: open() ? "auto" : "none",
    /** touch-action: manipulation evita che iOS ritardi il click di 300ms. */
    touchAction: "manipulation",
    /** -webkit-tap-highlight per togliere l'highlight blu su tap iOS. */
    WebkitTapHighlightColor: "transparent",
  });

  const onBackdropTap = (ev: Event) => {
    ev.stopPropagation();
    if (open() && nowMs() < ignoreBackdropCloseUntilMs) {
      return;
    }
    if (feedbackActive()) {
      onFeedbackDismiss?.();
      return;
    }
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
  /** Su mob/tab il mouseenter/leave è inaffidabile (touch, false leave): non usare hover per aprire/chiudere. */
  const hoverShellOk = () => device() === "des";

  const onMouseEnter = () => {
    if (!hoverShellOk() || !hoverIn) return;
    requestOpen();
  };
  const onMouseLeave = () => {
    pressed(false);
    if (!hoverShellOk()) return;
    /** hoverOut chiude senza conferma (sarebbe UX fastidiosa). */
    const leaveCloses =
      hoverOut === true ||
      (typeof hoverOut === "function" && !!(hoverOut as () => boolean)());
    if (leaveCloses && open()) {
      open(false);
      onClose?.();
    }
  };

  const feedMeasureHostStyle: Record<string, string> = {
    ...measureHostStyle,
    display: "flex",
    flexDirection: "column",
    alignItems: "stretch",
    justifyContent: "flex-start",
    gap: "16px",
    paddingTop: "28px",
    paddingRight: "20px",
    paddingBottom: "24px",
    paddingLeft: "20px",
    boxSizing: "border-box",
    minWidth: "240px",
  };

  const renderFeedbackMeasure = () => (
    <>
      <div style={{ ...feedbackIconRowStyle, color: "#fff" } as any}>
        <icon name="check" size={10} stroke={2} s="text-#fff" />
      </div>
      <div style={feedbackMsgStyle as any}>User was created.</div>
      <div style={feedbackFooterRowStyle as any}>
        <div style={feedbackDismissBtnStyle as any}>OK</div>
      </div>
    </>
  );

  /**
   * Il `div` del framework appende `children` solo alla creazione: se il feedback è vuoto al primo
   * paint, l’overlay resta senza nodi per sempre. Qui montiamo il contenuto dentro un `watch`.
   */
  let feedbackReactiveMount: HTMLElement | null = null;
  const feedbackOverlayNodes = (f: PopmenuFeedback) => {
    const showBtn = f.showDismissButton !== false;
    const lbl = f.dismissLabel ?? (f.kind === "success" ? "OK" : "Back");
    return (
      <>
        <div style={{ ...feedbackIconRowStyle, color: "#fff" } as any}>
          {f.kind === "success" ? (
            <icon name="check" size={10} stroke={2} s="text-#fff" />
          ) : (
            <icon name="shieldAlert" size={10} stroke={2} s="text-#fff" />
          )}
        </div>
        {f.message ? <div style={feedbackMsgStyle as any}>{f.message}</div> : null}
        {showBtn ? (
          <div style={feedbackFooterRowStyle as any}>
            <div
              style={feedbackDismissBtnStyle as any}
              click={() => {
                onFeedbackDismiss?.();
              }}
            >
              {lbl}
            </div>
          </div>
        ) : null}
      </>
    );
  };

  const getFeedbackReactiveMount = (): HTMLElement | null => {
    if (feedback === undefined) return null;
    if (feedbackReactiveMount == null) {
      const el = document.createElement("span");
      el.style.display = "contents";
      feedbackReactiveMount = el;
      const stop = watch(() => {
        const f = readFeedback();
        replaceChildrenWithDispose(el);
        if (!f) return;
        const nodes = toNodes(feedbackOverlayNodes(f));
        if (nodes.length) el.append(...nodes);
      });
      onNodeDispose(el, stop);
    }
    return feedbackReactiveMount;
  };

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
    <div
      ref={(el) => {
        if (!el) return;
        wrapEl = el as HTMLDivElement;
        onNodeDispose(el, () => {
          cancelPendingTeardown();
          teardownPortal();
        });
      }}
      style={wrapStyle as any}
    >
      <div ref={observeSize(cw, ch)} style={measureHostStyle as any}>
        <div
          s={wrapperCollapsedS as any}
          style={collapsedSlotAlignStyle as any}
        >
          {collapsed()}
        </div>
      </div>
      <div ref={observeSize(ew, eh)} style={measureHostStyle as any}>
        {extended()}
      </div>
      {/* Measure host per la conferma: calcola la size naturale richiesta dall'overlay. */}
      {confirmCollapsed ? (
        <div ref={observeSize(confW, confH)} style={confirmMeasureHostStyle as any}>
          {(() => {
            const c = confirmMeasureCopy();
            return (
              <>
                <div style={confirmMessageStyle as any}>{c.msg}</div>
                <div style={confirmButtonsRowStyle as any}>
                  <div style={btnStyle("no") as any}>{c.no}</div>
                  <div style={btnStyle("yes") as any}>{c.yes}</div>
                </div>
              </>
            );
          })()}
        </div>
      ) : null}
      {feedback !== undefined ? (
        <div ref={observeSize(feedW, feedH)} style={feedMeasureHostStyle as any}>
          {renderFeedbackMeasure()}
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
        style={boxStyle as any}
        s={shellS as any}
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
        <div style={slotStyle(cw, ch, () => !open()) as any}>
          <div
            s={wrapperCollapsedS as any}
            style={collapsedSlotAlignStyle as any}
          >
            {collapsed()}
          </div>
        </div>
        <div style={slotStyle(ew, eh, () => open() && !feedbackActive()) as any}>{extended()}</div>

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

        <div
          data-fw-popmenu-feedback=""
          style={feedbackBarStyle as any}
          click={(ev: Event) => ev.stopPropagation()}
        >
          {getFeedbackReactiveMount()}
        </div>
      </div>
    </div>
  );
}