import { des, For, mob, state, tab, watch } from "client";

const BRUCIARE_DES = new URL("./BRUCIARE.webm", import.meta.url).href;
const BRUCIARE_MOB = new URL("./BRUCIARE_mob.webm", import.meta.url).href;

const problems = [
  {
    icon: "receiptEuro",
    text: "Vendono poco",
    description:
      "Porti persone sul sito, ma non comprano. Restano, guardano e poi spariscono. Ogni giorno investi per riempire un secchio bucato: tanto traffico, pochi clienti, cassa che non cresce.",
  },
  {
    icon: "monitor",
    text: "Utenti in fuga",
    description:
      "Si apre lenta, si blocca, fa perdere tempo. Al primo intoppo le persone chiudono e non tornano. Quando arrivano in tanti, il sistema cede proprio nel momento in cui dovresti vendere di piu.",
  },
  {
    icon: "palette",
    text: "Brand anonimo",
    description:
      "Sembri uguale a tutti e il cliente non capisce perche scegliere te. Quando non vede differenze, guarda solo il prezzo. Cosi finisci a scontare per chiudere e il tuo valore sparisce.",
  },
  {
    icon: "clock",
    text: "Ritardi e soldi bloccati",
    description:
      "Ti promettono una data, poi slitta ancora e ancora. Intanto hai gia versato soldi e resti fermo mentre i concorrenti pubblicano e incassano. Alla fine paghi due volte: denaro bloccato e occasioni perse.",
  },
] as const;

const N = problems.length;

/** Larghezza massima card (stesso `maxw-32rem` degli stili); usata nel `calc` dello stagger. */
const CARD_MAX_W = "32rem";

/**
 * Sotto questa larghezza viewport (px) su desktop **non** usiamo stagger + linee: layout a colonna come tablet/mobile.
 * MacBook Air / finestre strette: alza il valore se vuoi il diagramma solo su monitor più larghi.
 */
const MIN_VIEWPORT_PX_FOR_CONNECTOR_LAYOUT = 1180;

/**
 * Opacità 0–1 della traccia verticale **chiara** (linea fissa; la pulsazione rossa è a parte).
 * Più alto = linea più visibile; più basso = più velata.
 */
const CONNECTOR_TRACK = {
  grad0: 0.12,
  grad1: 0.28,
  grad2: 0.1,
  inset: 0.32,
  outer: 0.12,
} as const;

/**
 * Tab/desktop: stagger sullo slack; ultima card `ml:auto` + larghezza fissa (il `calc` al bordo rompeva la `row`).
 * `flexWrap: nowrap` perché `row` nel map ha `flex-wrap: wrap` e con poca larghezza i figli andavano a capo (“tutto verticale”).
 */
/** Stile wrapper card (stagger larghezza/posizione), senza flex della row interna. */
function cardWrapperStaggerStyle(
  index: number,
  total: number,
  useStagger: boolean,
): Record<string, string> | undefined {
  if (mob()) return undefined;
  if (!useStagger) {
    return { width: `min(${CARD_MAX_W}, 100%)`, marginLeft: "auto", marginRight: "auto" };
  }
  if (total <= 1) return { width: `min(${CARD_MAX_W}, 100%)` };
  const slack = `(100% - min(${CARD_MAX_W}, 100%))`;
  const d = total - 1;
  const last = index === total - 1;
  if (index <= 0 && !last) return { width: `min(${CARD_MAX_W}, 100%)` };
  if (last) return { marginLeft: "auto", width: `min(${CARD_MAX_W}, 100%)` };
  return {
    marginLeft: `calc(${index} / ${d} * ${slack})`,
    width: `min(${CARD_MAX_W}, calc(100% - ${index} / ${d} * ${slack}))`,
  };
}

/** `flex-wrap: nowrap` solo con layout a connettori (viewport abbastanza largo). */
function cardRowNowrapStyle(useStagger: boolean): Record<string, string> | undefined {
  if (!useStagger) return undefined;
  return { flexWrap: "nowrap" };
}

/**
 * Asse verticale: leggermente a sinistra rispetto al centro icona (−~10px).
 * Base: `pl-3.5rem` + offset icona + metà step (~0.5rem) come il div `ml-3` con `<icon>`.
 */
const ICON_AXIS_FROM_CARD_LEFT = "calc(3.5rem + 0.75rem + 0.5rem - 0.55rem)";

const PULSE_CYCLE_S = 2.35;
const PULSE_STAGGER_S = 0.48;

/**
 * Card con layout connettori: altezza fissa così il fondo delle card è allineato e le barre verso la pill
 * dipendono solo dall’indice (distanza verticale), non dalla lunghezza del testo.
 */
const CONNECTOR_CARD_ROW_H = "clamp(16rem, 22vh, 34rem)";

/** Altezza minima card + gap (devono coincidere col `calc` delle linee su `des` con layout connettori). */
function layoutCardRow(useConnectorLayout: boolean): string {
  if (mob()) return "auto";
  if (useConnectorLayout) return CONNECTOR_CARD_ROW_H;
  return "clamp(9rem, 14vh, 18rem)";
}

const LAYOUT_ROW_GAP_DES = "4vh";

/**
 * Dal fondo della card alla barra: stessi gap del `col` + padding-top dell’hub + coda per allineare alla pill.
 */
const HUB_PAD_TOP = "2.25rem";

/** Mob: spazio sopra la pill (più basso = barra + testo più su). */
const HUB_PAD_TOP_MOB = "0.5rem";

/**
 * Stessi termini del vecchio `calc` (slack tra card + coda fin sotto la pill), usati nel fallback SSR.
 */
const CONNECTOR_BLOCK_HEIGHT_SLACK = "0.32rem";
const CONNECTOR_MEET_BAR_REM = "1.22rem";

/** Punto sulla barra verso cui misurare l’altezza (0.5 centro, 1 bordo inferiore). */
const CONNECTOR_RAIL_TARGET_RATIO = 0.88;
const CONNECTOR_RAIL_TARGET_OFFSET_PX_FALLBACK = 5;
/** Accorcia le linee in modo uniforme (render; la misura DOM è grezza). */
const CONNECTOR_LENGTH_TRIM_PX = 16;
/** Ulteriore lunghezza oltre il punto misurato (verso il basso). */
const CONNECTOR_EXTEND_INTO_RAIL_PX = 32;

/**
 * Fallback se non c’è ancora la misura: stima da `layoutCardRow` (può divergere se le card crescono col testo).
 */
function connectorHeightCalc(index: number, total: number, useConnectorLayout: boolean): string {
  const row = layoutCardRow(useConnectorLayout);
  const gap = LAYOUT_ROW_GAP_DES;
  const blocks = total - 1 - index;
  const block = `(${row} + ${gap} + ${CONNECTOR_BLOCK_HEIGHT_SLACK})`;
  const tailPx =
    CONNECTOR_RAIL_TARGET_OFFSET_PX_FALLBACK -
    CONNECTOR_LENGTH_TRIM_PX +
    CONNECTOR_EXTEND_INTO_RAIL_PX;
  return `calc(${blocks} * ${block} + ${gap} + ${HUB_PAD_TOP} + ${CONNECTOR_MEET_BAR_REM} + ${Math.max(0, tailPx)}px)`;
}

/**
 * Solo barre: distanza dal fondo di ogni `.problem-cw` al bordo superiore della pill, senza toccare layout card/icone.
 */
function measureConnectorHeightsToRail(root: Element): number[] | null {
  const rail = root.querySelector(".problem-hub-rail");
  if (!rail) return null;
  const railRect = rail.getBoundingClientRect();
  const railTargetY = railRect.top + railRect.height * CONNECTOR_RAIL_TARGET_RATIO;
  const out: number[] = [];
  for (let i = 0; i < N; i++) {
    const cw = root.querySelector(`:scope > .problem-cw[data-problem-card-index="${i}"]`) as HTMLElement | null;
    if (!cw) return null;
    const bottom = cw.getBoundingClientRect().bottom;
    if (!Number.isFinite(bottom) || !Number.isFinite(railTargetY)) return null;
    /** Distanza grezza card→barra: il trim si applica solo in `connectorTrackStyle` (evita state “congelato”). */
    const px = railTargetY - bottom;
    out.push(Math.max(0, px));
  }
  return out;
}

function connectorTrackStyle(
  index: number,
  total: number,
  useConnectorLayout: boolean,
  heightPx: number | null | undefined,
): Record<string, string> {
  const { grad0, grad1, grad2, inset, outer } = CONNECTOR_TRACK;
  const height =
    heightPx != null && Number.isFinite(heightPx) && heightPx > 0
      ? `${Math.max(0, heightPx - CONNECTOR_LENGTH_TRIM_PX + CONNECTOR_EXTEND_INTO_RAIL_PX)}px`
      : connectorHeightCalc(index, total, useConnectorLayout);
  return {
    position: "absolute",
    left: ICON_AXIS_FROM_CARD_LEFT,
    transform: "translateX(-50%)",
    top: "100%",
    height,
    width: "4px",
    borderRadius: "4px",
    overflow: "hidden",
    zIndex: "4",
    pointerEvents: "none",
    background: `linear-gradient(180deg, rgba(255,255,255,${grad0}) 0%, rgba(255,255,255,${grad1}) 50%, rgba(255,255,255,${grad2}) 100%)`,
    boxShadow: `inset 0 0 6px rgba(255,255,255,${inset}), 0 0 12px rgba(255,255,255,${outer})`,
    transition: "opacity 0.32s ease",
  };
}

function connectorPulseStyle(index: number): Record<string, string> {
  return {
    position: "absolute",
    left: "0",
    width: "100%",
    height: "28%",
    top: "-18%",
    borderRadius: "99px",
    background: `linear-gradient(180deg,
      rgba(255,0,0,0) 0%,
      rgba(255,0,0,0.75) 28%,
      rgba(255,40,40,1) 48%,
      rgba(255,0,0,0.95) 62%,
      rgba(255,0,0,0.55) 82%,
      rgba(255,0,0,0) 100%)`,
    boxShadow:
      "0 0 16px rgba(255,0,0,1), 0 0 32px rgba(255,0,0,0.65), 0 0 48px rgba(255,0,0,0.35), 0 6px 24px rgba(255,0,0,0.5)",
    animationDelay: `${index * PULSE_STAGGER_S}s`,
  };
}

const problemConnectorsCss = `
@keyframes problem-pulse-down {
  0% { top: -22%; opacity: 0; filter: blur(4px); }
  10% { opacity: 0.95; filter: blur(1.5px); }
  82% { top: 68%; opacity: 1; filter: blur(0.5px); }
  88% { top: 86%; opacity: 1; filter: brightness(1.4) blur(0); }
  94% { top: 96%; opacity: 0.9; }
  100% { top: 108%; opacity: 0; filter: blur(2px); }
}
/** Luce rossa molto soft sull’impatto (niente alone aggressivo). */
@keyframes problem-hub-gentle-pulse {
  0%, 78% {
    opacity: 1;
    filter: brightness(1);
    box-shadow:
      0 0 6px rgba(255,0,0,0.12),
      0 0 14px rgba(255,0,0,0.06),
      inset 0 1px 5px rgba(255,255,255,0.28);
  }
  86% {
    filter: brightness(1.08);
    box-shadow:
      0 0 14px rgba(255,0,0,0.22),
      0 0 22px rgba(255,0,0,0.1),
      inset 0 1px 4px rgba(255,240,240,0.35);
  }
  93%, 100% {
    filter: brightness(1.03);
    box-shadow:
      0 0 8px rgba(255,0,0,0.14),
      0 0 16px rgba(255,0,0,0.07),
      inset 0 1px 5px rgba(255,255,255,0.3);
  }
}
@keyframes problem-hub-bg-flow {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}
@keyframes problem-price-bump {
  0%, 78% { transform: scale(1); text-shadow: 0 0 0 transparent; }
  86% { transform: scale(1.14); text-shadow: 0 0 28px rgba(255,0,0,0.85), 0 0 56px rgba(255,0,0,0.4); }
  90% { transform: scale(1.05); }
  94%, 100% { transform: scale(1); text-shadow: 0 0 16px rgba(255,0,0,0.45); }
}
@keyframes problem-mob-border-rotate {
  to { transform: rotate(360deg); }
}
.problem-connector-pulse {
  animation: problem-pulse-down ${PULSE_CYCLE_S}s cubic-bezier(0.33, 0.9, 0.32, 1) infinite;
  will-change: top, filter, opacity;
}
/* Solo spazio sopra la pill; trasparente così le linee verticali non risultano “tagliate”. */
.problem-hub-spacer {
  width: 100%;
  flex-shrink: 0;
  pointer-events: none;
}
.problem-hub-rail {
  position: relative;
  z-index: 5;
  height: 10px;
  border-radius: 999px;
  box-sizing: border-box;
  border: 1px solid rgba(255,255,255,0.2);
  max-width: 100%;
  background: linear-gradient(
    90deg,
    rgba(255,255,255,0.07) 0%,
    rgba(255,180,180,0.35) 22%,
    rgba(255,0,0,0.82) 48%,
    rgba(255,100,100,0.45) 72%,
    rgba(255,255,255,0.06) 100%
  );
  background-size: 220% 100%;
  animation:
    problem-hub-bg-flow 9s ease-in-out infinite,
    problem-hub-gentle-pulse ${PULSE_CYCLE_S}s cubic-bezier(0.4, 0, 0.2, 1) infinite;
}
/* Fascia full-viewport: il padding-top tra barra e testo tappa le linee (il margin no). */
.problem-hub-text-band {
  position: relative;
  z-index: 12;
  width: 100vw;
  left: 50%;
  transform: translateX(-50%);
  box-sizing: border-box;
  padding-top: 2.75rem;
  padding-bottom: calc(1.25rem + 5vh);
  padding-left: 1.5rem;
  padding-right: 1.5rem;
}
.problem-hub-text {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: center;
  gap: 0.1rem 1rem;
  width: 100%;
  max-width: min(100%, clamp(24rem, 98%, 80rem));
  margin-left: auto;
  margin-right: auto;
}
@media (max-width: 768px) {
  .problem-hub-text-band {
    padding-top: 2rem;
    padding-bottom: calc(1rem + 5vh);
    padding-left: 1rem;
    padding-right: 1rem;
  }
}
.problem-price-euro {
  display: inline-block;
  animation: problem-price-bump ${PULSE_CYCLE_S}s cubic-bezier(0.34, 1.56, 0.64, 1) infinite;
}

.problem-mob-shell {
  position: relative;
  border-radius: 20px;
}
.problem-mob-shell > .problem-mob-border-spin {
  position: absolute;
  inset: -2px;
  border-radius: 22px;
  pointer-events: none;
  z-index: 0;
  overflow: hidden;
}
.problem-mob-border-spin-inner {
  position: absolute;
  inset: -40%;
  background: conic-gradient(
    from 0deg,
    transparent 0deg,
    rgba(255,0,0,0.12) 80deg,
    rgba(255,80,80,0.22) 120deg,
    transparent 200deg,
    transparent 360deg
  );
  animation: problem-mob-border-rotate 18s linear infinite;
}
.problem-mob-shell > .problem-card-inner {
  position: relative;
  z-index: 1;
}
@media (prefers-reduced-motion: reduce) {
  .problem-connector-pulse,
  .problem-hub-rail,
  .problem-price-euro {
    animation: none !important;
  }
  .problem-card-face {
    transform: none !important;
  }
  .problem-mob-border-spin-inner {
    animation: none !important;
  }
}

/* Hover: card attiva ~105%; altre card + linee correlate attenuate */
.problem-card-col:has(.problem-cw-0:hover) .problem-cw:not(.problem-cw-0) { opacity: 0.38; }
.problem-card-col:has(.problem-cw-1:hover) .problem-cw:not(.problem-cw-1) { opacity: 0.38; }
.problem-card-col:has(.problem-cw-2:hover) .problem-cw:not(.problem-cw-2) { opacity: 0.38; }
.problem-card-col:has(.problem-cw-3:hover) .problem-cw:not(.problem-cw-3) { opacity: 0.38; }

.problem-cw {
  position: relative;
  z-index: 1;
  transition: opacity 0.32s ease;
}
.problem-cw:hover {
  z-index: 2;
}
.problem-card-face {
  transform-origin: center center;
  transition: transform 0.32s cubic-bezier(0.34, 1.02, 0.35, 1);
}
.problem-cw-0:hover .problem-card-face,
.problem-cw-1:hover .problem-card-face,
.problem-cw-2:hover .problem-card-face,
.problem-cw-3:hover .problem-card-face {
  transform: scale(1.05);
}
`;

export default function Problem() {
  const wideViewportForConnectors = state(false);
  const connectorHeightsPx = state<number[] | null>(null);

  watch(() => {
    mob();
    tab();
    des();
    const sync = (): void => {
      if (typeof window === "undefined") return;
      wideViewportForConnectors(des() && window.innerWidth >= MIN_VIEWPORT_PX_FOR_CONNECTOR_LAYOUT);
    };
    sync();
    window.addEventListener("resize", sync);
    watch.onCleanup(() => window.removeEventListener("resize", sync));
  });

  watch(() => {
    mob();
    tab();
    des();
    const layout = des() && wideViewportForConnectors();
    if (!layout) {
      connectorHeightsPx(null);
      return;
    }
    const run = (): void => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const root = document.querySelector("[data-problem-connector-root]");
          if (!root) return;
          const next = measureConnectorHeightsToRail(root);
          if (next) connectorHeightsPx(next);
        });
      });
    };
    queueMicrotask(run);
    run();
    window.addEventListener("resize", run);
    if (typeof document !== "undefined" && document.fonts?.ready) {
      void document.fonts.ready.then(run);
    }
    let ro: ResizeObserver | undefined;
    const t = window.setTimeout(() => {
      const root = document.querySelector("[data-problem-connector-root]");
      if (root) {
        ro = new ResizeObserver(run);
        ro.observe(root);
      }
    }, 0);
    watch.onCleanup(() => {
      window.clearTimeout(t);
      window.removeEventListener("resize", run);
      ro?.disconnect();
    });
  });

  const useConnectorLayout = des() && wideViewportForConnectors();
  const measuredConnectorHeights = connectorHeightsPx();

  const titleS = {
    base: "font-7 text-center maxw-100%",
    des: "text-10",
    tab: "text-9 px-2",
    mob: "text-8 ",
  } as const;

  const problemStackS = {
    base: "col minw-0",
    des: useConnectorLayout
      ? "relative overflow-visible mt-7vh w-60vw maxw-72rem gapy-4vh pb-6"
      : "relative overflow-visible mt-7vh w-92vw maxw-76rem px-3vw gapy-3vh pb-6",
    tab: "relative overflow-visible mt-5vh w-96vw maxw-76rem minw-0 px-2vw pb-6 gapy-3vh",
    mob: "relative overflow-visible mt-7vh w-100% maxw-100% px-3 gapy-5.5vh pb-5",
  } as const;

  return (
    <div
      s={{
        base: "col center children-center round-20px",
        des: "w-60vw pb-10vh",
        tab: "w-96vw pb-8vh px-2",
        mob: "w-100% maxw-100% pb-8vh px-3",
      }}
    >
      <video
        src={des() ? BRUCIARE_DES : BRUCIARE_MOB}
        s={{
          des: "w-40vw maxw-70rem",
          tab: "w-88vw maxw-72rem",
          mob: "w-100% maxw-100%",
        }}
        blend
        autoplay
        loop
        muted
      />

      <style dangerouslySetInnerHTML={{ __html: problemConnectorsCss }} />
      <t s={titleS}>SOLDI PER SOFTWARE MEDIOCRI</t>
      <div
        className={useConnectorLayout ? "problem-card-col" : undefined}
        data-problem-connector-root={useConnectorLayout ? "" : undefined}
        s={problemStackS}
      >
        <For each={problems}>
          {(problem, index) => {
            const tabDes = "py-3vh px-2vw";
            const cwClass = useConnectorLayout ? `problem-cw problem-cw-${index}` : undefined;
            const stagger = useConnectorLayout;
            const wrapClass = [mob() && "problem-mob-shell", cwClass].filter(Boolean).join(" ") || undefined;

            return (
              <div
                data-problem-card-index={index}
                className={wrapClass}
                style={
                  mob()
                    ? undefined
                    : {
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "stretch",
                        position: "relative",
                        ...cardWrapperStaggerStyle(index, N, stagger)!,
                      }
                }
              >
                {mob() ? (
                  <div className="problem-mob-border-spin" aria-hidden>
                    <div className="problem-mob-border-spin-inner" />
                  </div>
                ) : null}
                <div
                  className={
                    mob()
                      ? "problem-card-inner relative overflow-visible"
                      : useConnectorLayout
                        ? "problem-card-face"
                        : undefined
                  }
                  s={{
                    base: "relative overflow-visible b-2px b-#ffffff55 round-20px row pl-3.5rem",
                    mob: "py-3vh px-3vw pl-4.25rem maxw-32rem mx-auto bg-background",
                    tab: `${tabDes} maxw-32rem`,
                    des: `${tabDes} maxw-32rem`,
                    transition: "all",
                    hover: "b-#ffffff88 bg-#ffffff06",
                  }}
                  style={{
                    ...cardRowNowrapStyle(stagger),
                    ...(!mob() ? { minHeight: layoutCardRow(stagger) } : {}),
                  }}
                >
                  <div
                    s={{
                      base: "absolute top left ml-3 z-1 bg-background px-0.2vw -ty-50%",
                      mob: "ml-2.5",
                    }}
                  >
                    <icon name={problem.icon as any} size={mob() ? 10 : 8} s="text-#ff0000" />
                  </div>
                  <div s="flex-1 flex row children-left children-top minw-0 w-100%">
                    <div s="col children-left gapy-1 w-100%">
                      <t s="font-7 text-7">{problem.text}</t>
                      <t s="text-#ffffff64 text-6 font-5">{problem.description}</t>
                    </div>
                  </div>
                </div>
                <div
                  show={useConnectorLayout}
                  className="problem-connector-track"
                  style={connectorTrackStyle(index, N, stagger, measuredConnectorHeights?.[index])}
                >
                  <div className="problem-connector-pulse" style={connectorPulseStyle(index)} />
                </div>
              </div>
            );
          }}
        </For>

        <div
          s={{
            base: "col children-center w-100% relative overflow-visible gapy-0",
            mob: "gapy-2.5 -mt-4vh children-center",
          }}
        >
          <div
            className="problem-hub-spacer"
            aria-hidden
            style={{ height: mob() ? HUB_PAD_TOP_MOB : HUB_PAD_TOP }}
          />
          <div
            className="problem-hub-rail"
            style={{
              width: "min(100%, clamp(24rem, 98%, 80rem))",
            }}
          />
          <div
            className="problem-hub-text-band"
            s={{
              base: "bg-background w-100vw relative z-12",
            }}
          >
            <div className="problem-hub-text">
              <t
                s={{
                  base: "text-#ffffffb8 font-6",
                  des: "text-7",
                  tab: "text-7",
                  mob: "text-6",
                }}
              >
                E alla fine paghi tu
              </t>
              <t
                className="problem-price-euro"
                s={{
                  base: "weight-700 text-#ff0000",
                  des: "font-7 text-8",
                  tab: "font-7 text-8",
                  mob: "font-7 text-8",
                }}
              >
                20.000€
              </t>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
