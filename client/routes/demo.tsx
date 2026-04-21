import { state } from "client";

type Direction =
  | "top"
  | "bottom"
  | "left"
  | "right"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

interface PopmenuProps {
  /** Contenuto dello stato chiuso (factory). */
  collapsed: () => unknown;
  /** Contenuto dello stato aperto (factory). */
  extended: () => unknown;
  /** Direzione di espansione. Default "bottom-right". */
  direction?: Direction;
  /** Stile della shell (passato con token del framework, es. "bg-#545454 round-20px"). */
  s?: unknown;
}

const ANCHOR: Record<Direction, { top?: string; bottom?: string; left?: string; right?: string }> = {
  "top":          { bottom: "0", left: "50%" },
  "bottom":       { top: "0",    left: "50%" },
  "left":         { right: "0",  top: "50%"  },
  "right":        { left: "0",   top: "50%"  },
  "top-left":     { bottom: "0", right: "0"  },
  "top-right":    { bottom: "0", left: "0"   },
  "bottom-left":  { top: "0",    right: "0"  },
  "bottom-right": { top: "0",    left: "0"   },
};

const ANCHOR_TRANSFORM: Partial<Record<Direction, string>> = {
  "top":    "translateX(-50%)",
  "bottom": "translateX(-50%)",
  "left":   "translateY(-50%)",
  "right":  "translateY(-50%)",
};

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

function Popmenu({ collapsed, extended, direction = "bottom-right", s }: PopmenuProps) {
  const open = state(false);
  const cw = state(0);
  const ch = state(0);
  const ew = state(0);
  const eh = state(0);

  const anchor = ANCHOR[direction];
  const anchorTransform = ANCHOR_TRANSFORM[direction];

  const wrapStyle = () => ({
    position: "relative",
    display: "block",
    width: `${cw()}px`,
    height: `${ch()}px`,
  });

  const boxStyle = () => {
    const w = open() ? ew() : cw();
    const h = open() ? eh() : ch();
    const ready = w > 0 && h > 0;
    const st: Record<string, string> = {
      position: "absolute",
      width: `${w}px`,
      height: `${h}px`,
      cursor: "pointer",
      overflow: "hidden",
      opacity: ready ? "1" : "0",
      transition:
        "width 300ms cubic-bezier(0.2, 0.8, 0.2, 1), height 300ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity 150ms linear",
    };
    if (anchor.top != null) st.top = anchor.top;
    if (anchor.bottom != null) st.bottom = anchor.bottom;
    if (anchor.left != null) st.left = anchor.left;
    if (anchor.right != null) st.right = anchor.right;
    if (anchorTransform) st.transform = anchorTransform;
    return st;
  };

  /**
   * Slot: dimensione naturale fissa, ancorato top-left.
   * La shell fa da "finestra" (overflow:hidden) e rivela il contenuto man mano che cresce.
   * Niente reflow: il testo non va mai a capo durante la transizione.
   */
  const slotStyle = (w: () => number, h: () => number, visible: () => boolean) => () => ({
    position: "absolute",
    top: "0",
    left: "0",
    width: `${w()}px`,
    height: `${h()}px`,
    opacity: visible() ? "1" : "0",
    transition: "opacity 150ms linear",
    pointerEvents: visible() ? "auto" : "none",
  });

  return (
    <div style={wrapStyle as any}>
      {/* Misuratori fuori dal flusso: dimensione naturale dei due contenuti */}
      <div ref={observeSize(cw, ch)} style={measureHostStyle as any}>
        {collapsed()}
      </div>
      <div ref={observeSize(ew, eh)} style={measureHostStyle as any}>
        {extended()}
      </div>

      {/* Shell animata (bg + radius qui) */}
      <div
        s={s as any}
        style={boxStyle as any}
        click={() => {
          if (!open()) open(true);
        }}
        clickout={() => open(false)}
      >
        <div style={slotStyle(cw, ch, () => !open()) as any}>{collapsed()}</div>
        <div style={slotStyle(ew, eh, () => open()) as any}>{extended()}</div>
      </div>
    </div>
  );
}

export default function Demo() {
  return (
    <div s="mt-30 ml-50">
      <Popmenu
        direction="top"
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
          </div>
        )}
      />
    </div>
  );
}
