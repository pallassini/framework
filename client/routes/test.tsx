import { state } from "client";

type Direction =
  | "top" | "bottom" | "left" | "right"
  | "top-left" | "top-right" | "bottom-left" | "bottom-right";

type MotionValue<T> = T | { open?: T; close?: T };

interface Motion {
  /** ms. Singolo valore o `{ open, close }`. Default 240. */
  duration?: MotionValue<number>;
  /** CSS timing-function. Singolo o `{ open, close }`. Default "cubic-bezier(0.2, 0.8, 0.2, 1)". */
  easing?: MotionValue<string>;
}

interface PopmenuProps {
  collapsed: unknown;
  extended: unknown;
  /** Direzione di espansione + eventuali token extra di posizionamento ("bottom-right -mt-2"). */
  direction?: string;
  /** Stile del box (bg, padding, round, shadow, ...) — token del tuo framework. */
  s?: any;
  /** Controllo animazione. */
  motion?: Motion;
}

/** Ancoraggio del box absolute: lato/angolo opposto alla direzione di espansione. */
const POS: Record<Direction, { top?: string; bottom?: string; left?: string; right?: string; transform?: string }> = {
  "top":          { bottom: "0", left: "50%",   transform: "translateX(-50%)" },
  "bottom":       { top: "0",    left: "50%",   transform: "translateX(-50%)" },
  "left":         { right: "0",  top: "50%",    transform: "translateY(-50%)" },
  "right":        { left: "0",   top: "50%",    transform: "translateY(-50%)" },
  "top-left":     { bottom: "0", right: "0" },
  "top-right":    { bottom: "0", left: "0" },
  "bottom-left":  { top: "0",    right: "0" },
  "bottom-right": { top: "0",    left: "0" },
};

function pickMotion<T>(v: MotionValue<T> | undefined, phase: "open" | "close", fallback: T): T {
  if (v == null) return fallback;
  if (typeof v === "object" && v !== null && ("open" in v || "close" in v)) {
    return (v as { open?: T; close?: T })[phase] ?? fallback;
  }
  return v as T;
}

function parseDirection(raw: string): { dir: Direction; extra: string } {
  const parts = raw.trim().split(/\s+/);
  const first = parts[0] as Direction;
  const dir = first in POS ? first : "bottom-right";
  return { dir, extra: parts.slice(1).join(" ") };
}

/** Ref-callback che osserva l'elemento e scrive larghezza/altezza in due signal primitivi. */
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

function Popmenu({ collapsed, extended, direction = "bottom-right", s, motion }: PopmenuProps) {
  const open = state(false);
  const cw = state(0);
  const ch = state(0);
  const ew = state(0);
  const eh = state(0);
  const { dir, extra } = parseDirection(direction);
  const pos = POS[dir];

  const duration = () => pickMotion(motion?.duration, open() ? "open" : "close", 240);
  const easing = () => pickMotion(motion?.easing, open() ? "open" : "close", "cubic-bezier(0.2, 0.8, 0.2, 1)");

  const boxStyle = (): Record<string, string> => {
    const isOpen = open();
    const w = isOpen ? ew() : cw();
    const h = isOpen ? eh() : ch();
    const ready = w > 0 && h > 0;
    const st: Record<string, string> = {
      position: "absolute",
      overflow: "hidden",
      cursor: "pointer",
      transitionProperty: "width, height",
      transitionDuration: `${duration()}ms`,
      transitionTimingFunction: easing(),
      willChange: "width, height",
      visibility: ready ? "visible" : "hidden",
    };
    if (pos.top != null) st.top = pos.top;
    if (pos.bottom != null) st.bottom = pos.bottom;
    if (pos.left != null) st.left = pos.left;
    if (pos.right != null) st.right = pos.right;
    if (pos.transform != null) st.transform = pos.transform;
    if (ready) {
      st.width = `${w}px`;
      st.height = `${h}px`;
    }
    return st;
  };

  /** Fuori dal flusso, larghezza/altezza di contenuto: misura le dimensioni naturali del child. */
  const measuredHostStyle: Record<string, string> = {
    position: "fixed",
    top: "0",
    left: "0",
    width: "max-content",
    height: "max-content",
    visibility: "hidden",
    pointerEvents: "none",
    zIndex: "-1",
  };

  const fadeWrapStyle = (isVisible: () => boolean) => (): Record<string, string> => ({
    position: "absolute",
    left: "0",
    top: "0",
    width: "max-content",
    height: "max-content",
    opacity: isVisible() ? "1" : "0",
    pointerEvents: isVisible() ? "auto" : "none",
    transitionProperty: "opacity",
    transitionDuration: `${duration()}ms`,
    transitionTimingFunction: easing(),
  });

  return (
    <div
      s={{ base: { "relative inline-block": true, ...s } }}
      clickout={() => open(false)}
      click={() => open(!open())}
    >
      {/* Spacer: riserva nel flusso lo spazio del collapsed. */}
      <div s="opacity-0 events-none">{collapsed}</div>

      {/* Misuratori fuori dal box (in fixed, invisibili): prendono le dimensioni naturali. */}
      <div ref={observeSize(cw, ch)} style={measuredHostStyle as any}>
        {collapsed}
      </div>
      <div ref={observeSize(ew, eh)} style={measuredHostStyle as any}>
        {extended}
      </div>

      {/* Box animato con dimensioni reali in px. */}
      <div s={{ base: { [extra]: !!extra, ...s } }} style={boxStyle as any}>
        {/* Contenuti visibili: crossfade opacity. */}
        <div style={fadeWrapStyle(() => !open()) as any}>{collapsed}</div>
        <div style={fadeWrapStyle(() => open()) as any}>{extended}</div>
      </div>
    </div>
  );
}

export default function Test() {
  return (
    <div s="mt-30 ml-50">
      <Popmenu
        direction="bottom-right"
        motion={{
          duration: { open: 380, close: 280 },
          easing: { open: "cubic-bezier(0.2, 0.8, 0.2, 1)", close: "cubic-bezier(0.4, 0, 1, 1)" },
        }}
        s="px-2 py-2 round-20px bg-#545454"
        collapsed={<icon name="plus" size="6" s="p-1" stroke={3} />}
        extended={
          <div s="col gapy-2 px-3 py-3">
            <t s="text-4">Ciao</t>
            <t s="text-4">Ciao ciao</t>
            <t s="text-4">Ciao ciao ciao</t>
          </div>
        }
      />
    </div>
  );
}
