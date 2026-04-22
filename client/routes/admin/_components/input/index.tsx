import InputString, { type InputStringProps } from "./inputString";
import InputNumber, { type InputNumberProps } from "./inputNumber";

/**
 * Tipi supportati dal componente `Input` generico.
 * Ogni tipo ha la sua UI dedicata in un file separato (`inputString.tsx`, `inputNumber.tsx`, …).
 * Il tipo di default è `"string"`.
 */
export type InputType = "string" | "number";

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
  /** Dimensione 1..10. Default 3 (medio). Scala font e altezza in modo coerente. */
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
   * Colore "attivo" usato per bordo focus, label floating, caret e ring.
   * Sostituisce `var(--primary)` di default. Accetta qualsiasi valore CSS
   * (`"#ff8800"`, `"var(--accent)"`, ecc.).
   */
  accentColor?: string;
  /**
   * Colore "a riposo" usato per bordo e label quando l'input non è in focus
   * e non ha valore. Sostituisce il grigio tenue di default
   * (`rgba(255,255,255,0.22)` per il bordo, `rgba(255,255,255,0.55)` per la label).
   * Se passato, viene usato per entrambi.
   */
  restingColor?: string;
  /**
   * Se `false`, nasconde completamente il "ring" (box-shadow cyan) al focus.
   * Default: dipende dalla variante (attivo per `string`, spento per `number`).
   */
  showFocusShadow?: boolean;
  /**
   * Spessore del bordo in pixel. Default: `1`.
   * Accetta un numero (px) o una stringa CSS completa (`"2px"`, `"0.1rem"`).
   */
  borderWidth?: number | string;
};

/**
 * Unione discriminata: in base a `type`, TypeScript sa quali prop extra sono ammesse
 * (es. `min` e `max` sono disponibili solo quando `type="number"`).
 */
export type InputProps =
  | ({ type?: "string" } & InputStringProps)
  | ({ type: "number" } & InputNumberProps);

/**
 * Entry point: dispatch sullo `type` usando lo switch del framework.
 * Il pattern canonico del framework vuole il JSX diretto dentro `<case>` (non una factory):
 * così il body giusto viene montato/smontato reattivamente al cambio del `value` dello switch.
 */
export default function Input(props: InputProps) {
  const type = props.type ?? "string";
  return (
    <switch value={type}>
      <case when="string">
        <InputString {...(props as InputStringProps)} />
      </case>
      <case when="number">
        <InputNumber {...(props as InputNumberProps)} />
      </case>
    </switch>
  );
}
