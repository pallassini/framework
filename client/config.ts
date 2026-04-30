import { device } from "../core/client/style/viewport";
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
    smoothScroll: device() == "des" ? true : false,
    /**
     * Canvas di design per `w-N` / `h-N` / `maxw-N` / `maxh-N` / `minw-N` (N = % del canvas, 0–100, anche decimale: `w-1.2`, `h-3.7`).
     * Il valore è **% del canvas (lato `des`) convertita in `rem`**, poi scalata per viewport come `base` (mob 75%, tab 87.5% del `rem` desktop).
     * Default 1920×1080 @ 16px/rem: su `des`, `w-70` = 84rem; su `mob` = 63rem.
     * Su schermi più grandi del canvas l’`rem` resta stabile (niente crescita tipo `vw` puro).
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

  /**
   * Scala dimensionale coerente per il componente `<Input>` (e affini).
   * Ogni chiave 1..10 mappa le grandezze in `rem` per i 3 viewport (`mob`, `tab`, `des`).
   * - `font`: font size del testo dell'input
   * - `padX`/`padY`: padding interno del box
   * - `radius`: border-radius del box
   * - `labelFloating`: font size della label quando "flotta" sul bordo superiore
   * L'`<Input>` legge queste misure via `useViewport()` (o equivalente) e applica
   * la variante corretta su mobile/tablet/desktop senza hard-coding nel componente.
   */
  /**
   * Proporzioni coerenti con la scala del framework: `mob = 75%`, `tab = 87.5%`,
   * `des = 100%` (stessa regola di `buildBaseScaleMap`), tranne `padY` su `mob`
   * (leggermente più alto, v. `mobPadYScale` nel builder) per altezza campo / touch.
   */
  input: (() => {
    /** `padY` su mobile: un filo sopra la scala globale 0.75 (font/padX) così i campi
     *  non restano “schiacciati” in altezza (touch / leggibilità). */
    const mobPadYScale = 0.88;
    /** Base (100% = des) per size 1..10, poi scalata per mob/tab. */
    const base: Record<string, { font: number; padX: number; padY: number; radius: number; labelFloating: number }> = {
      "1": { font: 0.8125, padX: 0.65, padY: 0.55, radius: 0.55, labelFloating: 0.7 },
      "2": { font: 0.875, padX: 0.7, padY: 0.6, radius: 0.6, labelFloating: 0.74 },
      "3": { font: 0.9375, padX: 0.8, padY: 0.7, radius: 0.65, labelFloating: 0.8 },
      "4": { font: 1, padX: 0.9, padY: 0.78, radius: 0.7, labelFloating: 0.84 },
      "5": { font: 1.0625, padX: 1, padY: 0.86, radius: 0.75, labelFloating: 0.88 },
      "6": { font: 1.125, padX: 1.1, padY: 0.94, radius: 0.8, labelFloating: 0.92 },
      "7": { font: 1.25, padX: 1.2, padY: 1.02, radius: 0.85, labelFloating: 0.96 },
      "8": { font: 1.375, padX: 1.3, padY: 1.1, radius: 0.9, labelFloating: 1 },
      "9": { font: 1.5, padX: 1.4, padY: 1.2, radius: 0.95, labelFloating: 1.06 },
      "10": { font: 1.75, padX: 1.55, padY: 1.32, radius: 1.05, labelFloating: 1.14 },
    };
    const rem = (n: number): string => `${Number(n.toFixed(4))}rem`;
    const row = (k: string) => {
      const b = base[k];
      return {
        font: { mob: rem(b.font * 0.75), tab: rem(b.font * 0.875), des: rem(b.font) },
        padX: { mob: rem(b.padX * 0.75), tab: rem(b.padX * 0.875), des: rem(b.padX) },
        padY: { mob: rem(b.padY * mobPadYScale), tab: rem(b.padY * 0.875), des: rem(b.padY) },
        radius: { mob: rem(b.radius * 0.75), tab: rem(b.radius * 0.875), des: rem(b.radius) },
        labelFloating: { mob: rem(b.labelFloating * 0.75), tab: rem(b.labelFloating * 0.875), des: rem(b.labelFloating) },
      };
    };
    const out: Record<string, ReturnType<typeof row>> = {};
    for (const k of Object.keys(base)) out[k] = row(k);
    return out;
  })(),
};
