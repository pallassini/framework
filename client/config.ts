import { buildBaseScaleMap } from "../core/client/style/properties/utils/base-scale-rem";
import { v } from "../core/client/validator";

export const clientConfig = {
  // STATE
  state: {
    id: v.uuid(),
  },

  // SESSION STATE
  sessionState: {
    id: v.uuid(),
  },

  // PERSIST STATE
  persistState: {
    id: v.uuid(),
    
    devtools: {
      menu: "db" as "db" | "state",
    },
  },

  // STYLE
  style: {
    /** Stile tipo Lenis (Halo Lab): lerp unico, niente “strisciamento” solo in coda. */
    smoothScroll: true,
    /**
     * Canvas di design per `w-N` / `h-N` / `maxw-N` / `maxh-N` / `minw-N` (N = % del canvas, 0–100, anche decimale: `w-1.2`, `h-3.7`).
     * Il valore è **% del canvas convertito in `rem`** → su schermi più grandi del canvas NON esplode.
     * Default 1920×1080 @ 16px/rem: `w-70` = 84rem (= 1344px @ 16px/rem).
     */
    canvas: {
      width: 1920,
      height: 1080,
      remPx: 16,
    },
    /**
     * Spacing (padding, margin, gap, inset, w/h/maxw via token): **rem** puri, costanti per viewport.
     * Generato da `buildBaseScaleMap()` — stessa progressione, senza tabella manuale.
     * Suffissi **1–100** anche decimali (`p-1.2`, `gap-base-4.5`): interpolati sulla stessa curva.
     * Ratio fisso viewport: `mob` = 75%, `tab` = 87.5%, `des` = 100%.
     */
    base: buildBaseScaleMap(),
    /** Scala tipografica in **rem puri** per viewport. 1–5 body/UI, 6–7 titoli, 8–10 display. */
    text: {
      "1": { mob: "0.8125rem", tab: "0.875rem", des: "0.9375rem" },
      "2": { mob: "0.875rem", tab: "0.9375rem", des: "1rem" },
      "3": { mob: "0.9375rem", tab: "1rem", des: "1.0625rem" },
      "4": { mob: "1rem", tab: "1.0625rem", des: "1.125rem" },
      "5": { mob: "1.0625rem", tab: "1.125rem", des: "1.25rem" },
      "6": { mob: "1.1875rem", tab: "1.3125rem", des: "1.5rem" },
      "7": { mob: "1.375rem", tab: "1.5rem", des: "1.75rem" },
      "8": { mob: "1.625rem", tab: "1.875rem", des: "2.125rem" },
      "9": { mob: "2rem", tab: "2.375rem", des: "2.75rem" },
      "10": { mob: "2.5rem", tab: "3rem", des: "3.5rem" },
    },
    /** Icone allineate al testo: **stessi valori di `text`** allo stesso step. */
    icon: {
      "1": { mob: "0.8125rem", tab: "0.875rem", des: "0.9375rem" },
      "2": { mob: "0.875rem", tab: "0.9375rem", des: "1rem" },
      "3": { mob: "0.9375rem", tab: "1rem", des: "1.0625rem" },
      "4": { mob: "1rem", tab: "1.0625rem", des: "1.125rem" },
      "5": { mob: "1.0625rem", tab: "1.125rem", des: "1.25rem" },
      "6": { mob: "1.1875rem", tab: "1.3125rem", des: "1.5rem" },
      "7": { mob: "1.375rem", tab: "1.5rem", des: "1.75rem" },
      "8": { mob: "1.625rem", tab: "1.875rem", des: "2.125rem" },
      "9": { mob: "2rem", tab: "2.375rem", des: "2.75rem" },
      "10": { mob: "2.5rem", tab: "3rem", des: "3.5rem" },
    },
    /** Spessore bordo (`b-1`, `bt-2`, …): `px` puri, costanti per viewport. */
    border: {
      "1": { mob: "1px", tab: "1px", des: "1px" },
      "2": { mob: "2px", tab: "2px", des: "2px" },
      "3": { mob: "3px", tab: "3px", des: "3px" },
      "4": { mob: "4px", tab: "4px", des: "4px" },
      "5": { mob: "5px", tab: "6px", des: "6px" },
    },
    round: {
      "1": {
        mob: "0.1875rem",
        tab: "0.1875rem",
        des: "0.1875rem",
      },
      "2": {
        mob: "0.3125rem",
        tab: "0.3125rem",
        des: "0.3125rem",
      },
      "3": {
        mob: "0.4375rem",
        tab: "0.4375rem",
        des: "0.4375rem",
      },
      "4": {
        mob: "0.5625rem",
        tab: "0.5625rem",
        des: "0.5625rem",
      },
      "5": {
        mob: "0.75rem",
        tab: "0.75rem",
        des: "0.75rem",
      },
      circle: {
        mob: "50%",
        tab: "50%",
        des: "50%",
      },
    },
  },
};
