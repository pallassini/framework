import { state, watch } from "client";
import { clientConfig } from "../config";

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

function observeSize(setW: (v: number) => void, setH: (v: number) => void) {
  return ((el) => {
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const r = entry.contentRect;
      setW(Math.ceil(r.width));
      setH(Math.ceil(r.height));
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

export function Popmenu(props: PopmenuProps) {
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
  } = props;

  ensureBounceKeyframe();
  const open = state(false);
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
    const w = isOpen ? ew() : cw();
    const h = isOpen ? eh() : ch();
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
    padding: "18px 16px 16px",
    gap: "16px",
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
    padding: "12px 16px",
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

  const onPressDown = () => pressed(true);
  const onPressUp = () => pressed(false);
  const onMouseEnter = () => {
    if (hoverIn) requestOpen();
  };
  const onMouseLeave = () => {
    pressed(false);
    /** hoverOut chiude senza conferma (sarebbe UX fastidiosa). */
    if (hoverOut && open()) open(false);
  };

  return (
    <div style={wrapStyle as any}>
      <div ref={observeSize(cw, ch)} style={measureHostStyle as any}>
        {collapsed()}
      </div>
      <div ref={observeSize(ew, eh)} style={measureHostStyle as any}>
        {extended()}
      </div>

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

export default function Demo() {
  return (
    <div s="mt-30 ml-50">
      <Popmenu
        direction="bottom"
        offset={{ x: 0, y: 0 }}
        confirmCollapsed={true}
        s="bg-#545454 round-20px"
        collapsed={() => (
          <div s="p-2 row">
            <icon name="plus" size="6" stroke={3} />
          </div>
        )}
        extended={() => (
          <div s="col gapy-2 px-4 py-3">
            <t s="text-4">Ciao</t>
            <t s="text-4">Ciao ciao</t>
            <t s="text-4">Ciao ciao ciao</t>
            <input></input>
          </div>
        )}
      />
    </div>
  );
}
