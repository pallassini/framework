/**
 * Modalità cromatica globale per gli `<Input>`.
 *
 * - `"dark"`: pensato per bg **scuri** (nero/quasi nero). Bordi e label più
 *   chiari per staccarsi dal fondo.
 * - `"light"`: pensato per bg **chiari** (bianco/quasi bianco). Bordi e label
 *   scuri per essere leggibili. L'etichetta "opzionale" e i bottoni `+/−`
 *   vengono virati scuri così non si perdono.
 *
 * Se non passi `mode` sul `Form`/`Input`, il default effettivo è equivalente a
 * `"dark"`.
 */
export type InputMode = "dark" | "light";

export function normalizeInputMode(mode: InputMode | undefined): "dark" | "light" {
  if (mode === "light") return "light";
  return "dark";
}

export function inputSurfaceBg(mode: InputMode | undefined): string {
  const m = normalizeInputMode(mode);
  if (m === "light") return "var(--inputLight)";
  return "var(--inputDark)";
}

/**
 * Parole che in CSS indicano un colore/keyword, non un nome di custom property
 * (`red`, `transparent`, …) — in quel caso lasciamo la stringa così com'è.
 * @see https://developer.mozilla.org/en-US/docs/Web/CSS/named-color
 */
const CSS_COLOR_OR_KEYWORD = new Set(
  (
    "aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue " +
    "blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk " +
    "crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki " +
    "darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen " +
    "darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue " +
    "dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro " +
    "ghostwhite gold goldenrod gray green greenyellow grey honeydew hotpink indianred " +
    "indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral " +
    "lightcyan lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon " +
    "lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue lightyellow " +
    "lime limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid " +
    "mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise " +
    "mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy oldlace " +
    "olive olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise " +
    "palevioletred papayawhip peachpuff peru pink plum powderblue purple rebeccapurple " +
    "red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver " +
    "skyblue slateblue slategray slategrey snow springgreen steelblue tan teal thistle " +
    "tomato transparent turquoise violet wheat white whitesmoke yellow yellowgreen " +
    "currentcolor inherit initial unset revert"
  )
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean),
);

/**
 * Normalizza un colore per le prop `bg` / `accentColor` / `restingColor` / …
 *
 * - Valori CSS **completi** restano invariati: `#fff`, `rgb(...)`, `var(--x)`.
 * - Nome con **doppio trattino iniziale**: `--foo` → `var(--foo)`.
 * - Identificatore altrimenti: se **non** è un named color o keyword
 *   (es. `red`, `transparent`) → token tema `var(--nome)`.
 *   Esempio: `inputOptional` → `var(--inputOptional)`.
 */
export function mapColorToken(v: string | undefined): string | undefined {
  if (v === undefined) return undefined;
  const s = v.trim();
  if (s === "") return undefined;
  if (s.startsWith("var(")) return s;
  if (s.startsWith("#")) return s;
  if (/^(rgb|hsla?|hsl|oklch|lch|lab|color)\(/i.test(s)) return s;
  if (s.startsWith("--")) return `var(${s})`;
  if (/^[a-zA-Z_][\w-]*$/.test(s)) {
    if (CSS_COLOR_OR_KEYWORD.has(s.toLowerCase())) return s;
    return `var(--${s})`;
  }
  return s;
}

/**
 * Bordo/label a riposo per i campi `v…optional()`: sbiadito finché l’utente
 * non dà focus o non c’è un valore; poi vince `accent` da form/prop
 * (non sostituisce `restingColor` se passata esplicitamente sull’`<Input>`).
 */
export function optionalFieldMutedColor(): string {
  return mapColorToken("inputOptional") ?? "var(--inputOptional)";
}

/**
 * Sfondo per “tagliare” bordo/linee (placeholder flottante, “opzionale”, errore):
 * in **Popmenu** vince `--fw-popmenu-bg`; fuori, `fallback` (es. `resolvedBg()` del field).
 */
export function inputCutoutBackground(fallback: string): string {
  return `var(--fw-popmenu-bg, ${fallback})`;
}

/**
 * Bordo a riposo (senza focus) per campi **obbligatori** quando il box è
 * trasparente sopra al pop: contorno scuro coerente con `--inputDark`.
 */
export function inputRequiredRestingBorderColor(): string {
  return mapColorToken("inputDark") ?? "var(--inputDark)";
}

/**
 * Preset di colori risolti per una mode.
 * Ogni singola UI di `<Input>` legge queste chiavi e le usa come default —
 * le prop esplicite passate all'`<Input>` o al `Form` hanno sempre la precedenza.
 */
export type InputPalette = {
  /** Colore "attivo" (bordo focus, label floating, caret, ring). */
  accent: string;
  /** Bordo a riposo (no focus, no hover, no value). */
  restingBorder: string;
  /** Bordo in hover ma non focus. */
  hoverBorder: string;
  /** Colore testo principale dell'input (numero/stringa). */
  text: string;
  /** Colore della floating label a riposo (prima che "floti"). */
  labelResting: string;
  /** Colore della mini-etichetta "opzionale". */
  optionalColor: string;
  /**
   * Terna RGB (senza `rgb()`) per i bottoni `−`/`+` quando vanno tinteggiati:
   * servono due colori complementari. Il default scuro/light mantiene
   * rosso/verde ma con saturazione adattata così si vedono anche su bianco.
   */
  stepperMinusRgb: string;
  stepperPlusRgb: string;
  /** Colore testo dei bottoni `−`/`+` a riposo (né hover né press). */
  stepperResting: string;
  /** Attiva/disattiva la shadow di focus per default della mode. */
  showFocusShadow: boolean;
};

const PALETTES: Record<"dark" | "light", InputPalette> = {
  dark: {
    accent: "var(--inputDark)",
    restingBorder: "var(--inputDark)",
    hoverBorder: "var(--inputDark)",
    text: "var(--inputDark)",
    labelResting: "var(--inputDark)",
    optionalColor: "var(--inputOptional)",
    stepperMinusRgb: "248, 113, 113",
    stepperPlusRgb: "74, 222, 128",
    stepperResting: "var(--inputDark)",
    showFocusShadow: true,
  },
  light: {
    accent: "var(--inputLight)",
    restingBorder: "var(--inputLight)",
    hoverBorder: "var(--inputLight)",
    text: "var(--inputLight)",
    labelResting: "var(--inputLight)",
    optionalColor: "var(--inputOptional)",
    stepperMinusRgb: "220, 38, 38",
    stepperPlusRgb: "22, 163, 74",
    stepperResting: "var(--inputLight)",
    showFocusShadow: false,
  },
};

/**
 * Variabili su un wrapper attorno a ogni `<Input>`: annulla l'ereditarietà
 * `--fw-input-*` / `--inputDark|Light` iniettata dal **Popmenu** e riallinea
 * tutto al `mode` del **Form** (o `mode` sull'Input). Se `mode` è `undefined`,
 * non imposta nulla (vale il contesto, es. popmenu).
 */
export function formModeShellScopeVars(
  mode: InputMode | undefined,
): Record<string, string> {
  if (mode === undefined) return {};
  const n = normalizeInputMode(mode);
  const p = PALETTES[n];
  const surface = n === "light" ? "var(--inputLight)" : "var(--inputDark)";
  return {
    "--fw-input-accent": p.accent,
    "--fw-input-resting-border": p.restingBorder,
    "--fw-input-hover-border": p.hoverBorder,
    "--fw-input-text": p.text,
    "--fw-input-label-resting": p.labelResting,
    "--fw-input-optional": p.optionalColor,
    "--fw-input-stepper-resting": p.stepperResting,
    "--fw-input-surface": surface,
  };
}

/**
 * Risolve la palette effettiva da applicare a un `<Input>`:
 *  1. parte dal preset della `mode` (default come `"dark"`);
 *  2. sovrascrive bordo/label a focus con `accentColor` o, in alternativa, `focusColor`;
 *  3. sovrascrive bordo/label a riposo con `restingColor`;
 *  4. sovrascrive `showFocusShadow` se esplicita.
 */
export function resolvePalette(args: {
  mode: InputMode | undefined;
  /** Bordo/ring a focus; se manca si usa `focusColor`, altrimenti il preset. */
  accentColor?: string;
  /** Stesso ruolo di `accentColor` (nome più esplicito: bordo focus). `accentColor` vince se entrambi. */
  focusColor?: string;
  /** Bordo a riposo (no focus) e label floating a riposo, salvo override sull'`<Input>`. */
  restingColor?: string;
  showFocusShadow?: boolean;
}): InputPalette {
  const base = PALETTES[normalizeInputMode(args.mode)];
  const accent =
    mapColorToken(args.accentColor) ?? mapColorToken(args.focusColor) ?? base.accent;
  const resting = mapColorToken(args.restingColor);
  return {
    ...base,
    accent,
    restingBorder: resting ?? base.restingBorder,
    labelResting: resting ?? base.labelResting,
    showFocusShadow:
      args.showFocusShadow === undefined ? base.showFocusShadow : args.showFocusShadow,
  };
}
