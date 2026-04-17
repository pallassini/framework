import { des, For, mob } from "client";

const BRUCIARE_DES = new URL("./BRUCIARE.webm", import.meta.url).href;
const BRUCIARE_MOB = new URL("./BRUCIARE_mob.webm", import.meta.url).href;

const problems = [
  {
    icon: "palette",
    text: "Non personalizzate",
    description: "Template generici, niente brand né UX su misura per il tuo caso.",
  },
  {
    icon: "chartDown",
    text: "Poco performanti",
    description: "Lentezza, crash e debito tecnico che ti costano utenti e reputazione.",
  },
  {
    icon: "factory",
    text: "Impossibili da scalare",
    description: "Architetture rigide: ogni evoluzione diventa un progetto a parte.",
  },
  {
    icon: "receiptEuro",
    text: "e te le fanno pagare 20.000€.",
    description: "Preventivi alti per deliverable mediocri, con extra a ogni modifica.",
  },
] as const;

const N = problems.length;

/** Larghezza massima card (stesso `maxw-32rem` degli stili); usata nel `calc` dello stagger. */
const CARD_MAX_W = "32rem";

/**
 * Tab/desktop: stagger sullo slack; ultima card `ml:auto` + larghezza fissa (il `calc` al bordo rompeva la `row`).
 * `flexWrap: nowrap` perché `row` nel map ha `flex-wrap: wrap` e con poca larghezza i figli andavano a capo (“tutto verticale”).
 */
/** Stile wrapper card (stagger larghezza/posizione), senza flex della row interna. */
function cardWrapperStaggerStyle(index: number, total: number): Record<string, string> | undefined {
  if (mob()) return undefined;
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

/** `flex-wrap: nowrap` sulla row interna della card (solo tab/desktop). */
function cardRowNowrapStyle(): Record<string, string> | undefined {
  if (mob()) return undefined;
  return { flexWrap: "nowrap" };
}

/**
 * Asse verticale: leggermente a sinistra rispetto al centro icona (−~10px).
 * Base: `pl-3.5rem` + offset icona + metà step (~0.5rem) come il div `ml-3` con `<icon>`.
 */
const ICON_AXIS_FROM_CARD_LEFT = "calc(3.5rem + 0.75rem + 0.5rem - 0.55rem)";

const PULSE_CYCLE_S = 2.35;
const PULSE_STAGGER_S = 0.48;

/** Stessi passi del layout: altezza tipica card + `gapy-4vh` del contenitore (vedi `s` sul box bianco). */
const LAYOUT_CARD_ROW = "clamp(10rem, 17vh, 22rem)";
const LAYOUT_ROW_GAP = "4vh";

/**
 * Dal fondo della card `index` alla `hr`: `(total-1-index)` (card+gap), poi un `gapy-4vh` (anche dopo l’ultima card) + `padding-top` hub.
 */
const HUB_PAD_TOP = "2.25rem";

function connectorHeightFromCardBottom(index: number, total: number): string {
  const blocks = total - 1 - index;
  return `calc(${blocks} * (${LAYOUT_CARD_ROW} + ${LAYOUT_ROW_GAP}) + ${LAYOUT_ROW_GAP} + ${HUB_PAD_TOP} + 0.0625rem)`;
}

function connectorLineStyle(index: number, total: number): Record<string, string> {
  return {
    position: "absolute",
    left: ICON_AXIS_FROM_CARD_LEFT,
    transform: "translateX(-50%)",
    top: "100%",
    height: connectorHeightFromCardBottom(index, total),
    width: "3px",
    borderRadius: "2px",
    backgroundColor: "rgba(255,255,255,0.78)",
    boxShadow: "0 0 10px rgba(255,255,255,0.25)",
    zIndex: "0",
    pointerEvents: "none",
  };
}

export default function Problem() {
  return (
    <div
      s={{
        base: "col center children-center round-20px bb-2px bb-#ffffff64",
        des: "w-60vw pb-10vh",
        mob: "w-92vw",
      }}
    >
      <video
        src={des() ? BRUCIARE_DES : BRUCIARE_MOB}
        s={{
          des: "w-40vw maxw-70rem",
          mob: "w-92vw",
        }}
        blend
        autoplay
        loop
        muted
      />

      <t s="font-7 text-10">SOLDI PER SOFTWARE MEDIOCRI</t>
      <t s="text-#ffffff64 text-8 font-6">Ti vendono app</t>
      <div
        s={{
          base: "col gapy-4vh",
          des: "relative overflow-visible mt-7vh w-45vw maxw-76rem minw-0 pb-6",
          mob: "w-100% px-2vw gapy-4vh mt-4vh",
        }}
      >
        {/* Card: il gap è tra i figli diretti di questo col (non c’è un wrapper unico). */}
        <For each={problems}>
          {(problem, index) => {
            const tabDes = "py-3vh px-2vw";
            return (
              <div
                style={
                  mob()
                    ? undefined
                    : {
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "stretch",
                        position: "relative",
                        zIndex: "1",
                        ...cardWrapperStaggerStyle(index, N),
                      }
                }
              >
                <div
                  s={{
                    base: "relative overflow-visible b-2px b-#ffffff55 round-20px row pl-3.5rem",
                    mob: "py-3vh px-4vw maxw-32rem",
                    tab: `${tabDes} maxw-32rem`,
                    des: `${tabDes} maxw-32rem`,
                    transition: "all",
                    hover: "b-#ffffff88 bg-#ffffff06",
                  }}
                  style={{
                    ...cardRowNowrapStyle(),
                    ...(!mob() ? { minHeight: LAYOUT_CARD_ROW } : {}),
                  }}
                >
                  <div s="absolute top left ml-3 z-1 bg-background px-0.2vw -ty-50%">
                    <icon name={problem.icon as any} size={8} s="text-#ff0000" />
                  </div>
                  <div s="flex-1 flex row children-left children-top minw-0 w-100%">
                    <div s="col children-left gapy-1 w-100%">
                      <t s="font-7 text-7">{problem.text}</t>
                      <t s="text-#ffffff64 text-6 font-5">{problem.description}</t>
                    </div>
                  </div>
                </div>
                <div show={() => !mob()} style={connectorLineStyle(index, N)} />
              </div>
            );
          }}
        </For>

        {/* Hub in flusso: `gapy-4vh` dopo l’ultima card + `padding-top` per la barra più in basso (stesso valore nel `calc` delle linee). */}
        <div
          show={() => !mob()}
          s="col children-center gapy-2 w-100% relative z-2"
          style={{ paddingTop: HUB_PAD_TOP }}
        >
          <div
            style={{
              width: "min(92%, 48rem)",
              height: "1px",
              backgroundColor: "rgba(255,255,255,0.52)",
            }}
          />
          <t s="font-7 text-9 weight-600 text-#ff0000">20k$</t>
        </div>
      </div>
    </div>
  );
}
