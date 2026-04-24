import InputString, { type InputStringProps } from "./inputString";
import InputNumber, { type InputNumberProps } from "./inputNumber";
import type { InputMode } from "./presets";
import type { InputElementDom } from "./common";
import type { ClientEvents } from "../../../core/client/runtime/tag/props";
import type { InputProps as FwInputProps } from "../../../core/client/runtime/tag/tags/input";
import type { StyleInput } from "../../../core/client/style";
import type { Signal } from "../../../core/client/state/state";
import type { InlineStyleValue } from "../../../core/client/runtime/tag/props/style-inline";
import { resolveFieldBinding, type FieldBinding, type FormStyle } from "../../../core/client/form/form";

export type { InputMode } from "./presets";

/**
 * Tipi supportati dal componente `Input` generico.
 * Ogni tipo ha la sua UI dedicata in un file separato (`inputString.tsx`, `inputNumber.tsx`, …).
 * Il tipo di default è `"string"`.
 */
export type InputType = "string" | "number" | "password";

/**
 * `size` numerico da 1 a 10 (coerente col resto del framework: `text-N`, `p-N`, `round-Npx`).
 * Viene mappato a token CSS in `sizes.ts`.
 */
export type InputSize = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

/**
 * Props comuni a tutte le varianti di `<Input>`.
 * Le props specifiche del tipo (es. `min`/`max` per number) vivono nei singoli file UI.
 */
export type InputPropsBase = {
  /**
   * Dimensione 1..10.
   * Default: `size` del `Form` (se presente), altrimenti `3`.
   */
  size?: InputSize;
  /** Etichetta mostrata come floating label (si sposta sopra al focus/valore). */
  placeholder?: string;
  disabled?: boolean;
  autofocus?: boolean;
  /**
   * Colore di sfondo dietro l'input. Serve alla floating label per "tagliare"
   * visivamente il bordo superiore del box (la label deve combaciare col bg
   * dell'elemento contenitore, es. il Popmenu o la Card).
   * Accetta qualsiasi valore CSS (`"#fff"`, `"var(--secondary)"`, `"transparent"`).
   * Default: `"var(--secondary, #121212)"`.
   */
  bg?: string;
  /**
   * Colore a **focus** (bordo, label floating, caret, ring), come `focusColor`.
   * Se entrambe sono impostate, vince `accentColor`. Stessa convenzione
   * nomi/hex/`var()` degli altri colori.
   */
  accentColor?: string;
  /**
   * Colore del bordo (e stessi usi di `accentColor`) a **focus**; comodo su
   * `Form({ focusColor: "primary" })`. Se anche `accentColor` c'è, vince `accentColor`.
   */
  focusColor?: string;
  /**
   * Colore "a riposo" (senza focus) per bordo e label finché la label non ha valore
   * flottante, salvo opzionali. Stessa convenzione nomi/hex/`var()`.
   */
  restingColor?: string;
  /**
   * Se `false`, nasconde completamente il "ring" (box-shadow cyan) al focus.
   * Default: dipende dalla variante (attivo per `string`, spento per `number`).
   */
  showFocusShadow?: boolean;
  /**
   * Spessore del bordo in pixel. Default: `2`.
   * Accetta un numero (px) o una stringa CSS completa (`"2px"`, `"0.1rem"`).
   */
  borderWidth?: number | string;
  /**
   * Raggio angoli del box. Default globale: `var(--round)`; fallback alle metriche per size.
   * Accetta numero (px) o stringa CSS (`"20px"`, `"1rem"`).
   */
  round?: number | string;
  /**
   * Preset cromatico: `"dark"` o `"light"`, in linea con lo sfondo del
   * contenitore. Se ometti `mode` sul Form, vale il preset **scuro**.
   * `focusColor` / `restingColor` (o `accentColor` / `restingColor`) su Form o
   * sull'input sovrascrivono i bordi a focus e a riposo.
   * Può essere impostata su `Form({ mode })` e si propaga a tutti i campi.
   */
  mode?: InputMode;
  /**
   * Token `s` sul **guscio** del campo (il `div` esterno: label, stepper, bordi
   * nel layout). Bordi/hover/round/ padding vanno qui così non competono con lo
   * `style` interno sull’`<input>` (che in `mode=none` azzera il bordo).
   */
  s?: StyleInput | false | null | (() => unknown) | Signal<unknown>;
  /**
   * Opzionale: token `s` sull’`<input>` nativo (tipografia, override mirati).
   * La maggior parte dei casi usa solo `s` sul guscio.
   */
  sInput?: StyleInput | false | null | (() => unknown) | Signal<unknown>;
  /** Stile inline sull’`<input>` nativo: unito allo stile interno (le chiavi qui vincono). */
  style?:
    | InlineStyleValue
    | (() => InlineStyleValue)
    | Signal<InlineStyleValue>;
} & InputElementDom & {
  /** Come `<input>` del framework: si concatena con lo stato interno. */
  focus?: ClientEvents["focus"];
  /** Valore stringa (come il DOM) + `FocusEvent` (bolla), come sull'`<input>` nativo. */
  focusout?: FwInputProps["focusout"];
};

/**
 * Unione discriminata: in base a `type`, TypeScript sa quali prop extra sono ammesse
 * (es. `min` e `max` sono disponibili solo quando `type="number"`).
 */
export type InputProps =
  | ({ type?: "string" } & InputStringProps)
  | ({ type: "password" } & InputStringProps)
  | ({ type: "number" } & InputNumberProps);

function inferTypeFromField(field: FieldBinding | undefined): InputType | undefined {
  if (!field) return undefined;
  try {
    const meta = resolveFieldBinding(field).meta();
    if (meta?.kind === "number") return "number";
    if (meta?.kind === "password") return "password";
    if (meta?.kind === "string") return "string";
  } catch {
    // In fallback manteniamo il default storico.
  }
  return undefined;
}

/**
 * Entry point: dispatch sullo `type` usando lo switch del framework.
 * Il pattern canonico del framework vuole il JSX diretto dentro `<case>` (non una factory):
 * così il body giusto viene montato/smontato reattivamente al cambio del `value` dello switch.
 */
export default function Input(props: InputProps) {
  let fieldStyle: FormStyle | undefined;
  const f = (props as { field?: FieldBinding }).field;
  if (f) {
    try {
      fieldStyle = resolveFieldBinding(f).style();
    } catch {
      fieldStyle = undefined;
    }
  }
  const inferred = inferTypeFromField((props as { field?: FieldBinding }).field);
  const type = props.type ?? inferred ?? "string";
  const p = props as InputPropsBase;
  const size = p.size ?? fieldStyle?.size ?? 3;
  /** Stesso criterio di `size`: il `mode` del `Form` finisce nelle prop così la palette non resta a default `dark`. */
  const mode = p.mode ?? fieldStyle?.mode;
  const merged = { ...props, size, mode } as InputProps;
  return (
    <switch value={type}>
      <case when="string">
        <InputString {...(merged as InputStringProps)} />
      </case>
      <case when="password">
        <InputString
          {...(merged as InputStringProps)}
          passwordMode
        />
      </case>
      <case when="number">
        <InputNumber {...(merged as InputNumberProps)} />
      </case>
    </switch>
  );
}
