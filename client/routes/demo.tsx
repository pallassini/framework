import { state } from "client";
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
}

/**
 * Per ogni direzione:
 *  - vx/vy: vettore di espansione (dove "cresce"). +1 dx/giù, -1 sx/su, 0 centrato.
 *  - side: quali side CSS usare come ancoraggio (opposto alla direzione di espansione).
 */
type Axis = "top" | "bottom" | "left" | "right";

interface DirSpec {
  vx: -1 | 0 | 1;
  vy: -1 | 0 | 1;
  /** Lati CSS da ancorare (il valore numerico è calcolato dall'offset). */
  sides: Axis[];
  /** Eventuale transform per centrare ortogonalmente. */
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

/**
 * Converte offset {x, y} in valori per i lati ancorati, tenendo conto del verso di espansione.
 * - Se cresce a destra (vx=+1) e il side è "left" → left = offset.x
 * - Se cresce a sinistra (vx=-1) e il side è "right" → right = offset.x
 * - Se vx=0 (centrato) → usa "left: 50%" + transform, l'offset.x diventa traslazione extra.
 */
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

export function Popmenu({ collapsed, extended, direction = "bottom-right", offset, s }: PopmenuProps) {
  const open = state(false);
  const cw = state(0);
  const ch = state(0);
  const ew = state(0);
  const eh = state(0);

  const dir = DIRS[direction];
  /** Posizione di ancoraggio CHIUSA: sempre 0 (coincide col collapsed). */
  const closedPos = computeShellPosition(dir, {});
  /** Posizione di ancoraggio APERTA: applica l'offset (gap dal collapsed verso la direzione di espansione). */
  const openPos = computeShellPosition(dir, offset ?? {});

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
    const st: Record<string, string> = {
      position: "absolute",
      width: `${w}px`,
      height: `${h}px`,
      cursor: "pointer",
      overflow: "hidden",
      opacity: ready ? "1" : "0",
      transition:
        "width 300ms cubic-bezier(0.2, 0.8, 0.2, 1), height 300ms cubic-bezier(0.2, 0.8, 0.2, 1), top 300ms cubic-bezier(0.2, 0.8, 0.2, 1), left 300ms cubic-bezier(0.2, 0.8, 0.2, 1), right 300ms cubic-bezier(0.2, 0.8, 0.2, 1), bottom 300ms cubic-bezier(0.2, 0.8, 0.2, 1), transform 300ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity 150ms linear",
    };
    if (pos.styles.top != null) st.top = pos.styles.top;
    if (pos.styles.bottom != null) st.bottom = pos.styles.bottom;
    if (pos.styles.left != null) st.left = pos.styles.left;
    if (pos.styles.right != null) st.right = pos.styles.right;
    if (pos.transform) st.transform = pos.transform;
    return st;
  };

  /**
   * Slot: dimensione naturale fissa. Pinnato dallo STESSO lato in cui è ancorata la shell
   * (lato opposto alla direzione di espansione). Così il contenuto si rivela dal punto fisso
   * e "esce" verso la direzione di espansione, senza reflow.
   */
  const slotStyle = (w: () => number, h: () => number, visible: () => boolean) => (): Record<string, string> => {
    const st: Record<string, string> = {
      position: "absolute",
      width: `${w()}px`,
      height: `${h()}px`,
      opacity: visible() ? "1" : "0",
      transition: "opacity 150ms linear",
      pointerEvents: visible() ? "auto" : "none",
    };
    if (direction === "center") {
      st.top = "50%";
      st.left = "50%";
      st.transform = "translate(-50%, -50%)";
      return st;
    }
    for (const side of dir.sides) st[side] = "0";
    if (dir.vx === 0) st.left = "0";
    if (dir.vy === 0) st.top = "0";
    return st;
  };

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
        direction="center"
        offset={{ x: 0, y: 0 }}
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
