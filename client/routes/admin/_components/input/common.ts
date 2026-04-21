import { state, watch } from "client";
import {
  resolveFieldBinding,
  type FieldBinding,
} from "../../../../../core/client/form/form";
import type { FieldTypeDesc } from "../../../../../core/client/validator/field-meta";
import { inputMetrics } from "./sizes";
import type { InputSize } from "./index";

/**
 * Utility condivise tra tutte le UI `<Input type="...">`.
 *
 * L'obiettivo è avere un'unica funzione (`useInputCommon`) che gestisca la
 * parte "noiosa" comune — binding a `field`/`value`, errore reattivo, flag
 * `optional`, sfondo per la floating label, metriche viewport-aware — così
 * ogni variante UI può concentrarsi SOLO sul proprio valore tipato e sul
 * proprio JSX.
 */

/** Props minime che ogni UI di Input condivide. */
export type CommonInputArgs<T> = {
  size: InputSize;
  /** Binding a un campo di `Form({...})`. Se presente, ha priorità su `value`. */
  field?: FieldBinding;
  /** Override manuale dell'errore (string o funzione reattiva). */
  error?: string | undefined | (() => string | undefined);
  /** Override bg (altrimenti eredita da `field.bg()` o fallback). */
  bg?: string;
  /**
   * Letto dal field quando presente, altrimenti parsed dal `value` passato
   * alla UI (se supporta valore esterno non controllato).
   */
  readExternal: () => T | undefined;
  /** Serializzazione del valore tipato → string per la signal del form. */
  toString: (v: T | undefined) => string;
  /** Parse della string della signal del form → valore tipato. */
  fromString: (s: string) => T | undefined;
};

export type CommonInput<T> = {
  /** Metriche reattive (viewport-aware) per `size`. */
  m: () => ReturnType<typeof inputMetrics>;
  /** `true` se l'input è attualmente focalizzato. */
  focused: ReturnType<typeof state<boolean>>;
  /** Errore corrente (reattivo). `undefined` se valido. */
  readError: () => string | undefined;
  /** `true` se c'è un errore. */
  hasError: () => boolean;
  /** Signal testuale dell'errore (comoda per renderizzare direttamente). */
  errorText: ReturnType<typeof state<string>>;
  /** Sfondo risolto (prop → field → fallback). Reattivo. */
  resolvedBg: () => string;
  /** `true` se lo schema del field è `.optional()`. */
  isOptional: () => boolean;
  /**
   * Metadati del tipo del field (`min`/`max`/`int`/`step` per i number, ecc.).
   * Le UI possono leggerli per derivare constraint dalle prop del validator
   * senza che l'utente li ripeta come prop sull'`<Input>`.
   */
  meta: () => FieldTypeDesc | undefined;

  /** Legge il valore tipato corrente (field o `value`). Reattivo. */
  read: () => T | undefined;
  /** Scrive il valore tipato (aggiorna field se presente). */
  write: (v: T | undefined) => void;
};

/**
 * Hook comune per le UI di Input. Ritorna signal e funzioni reattive già
 * pronte; la singola UI usa solo ciò che le serve.
 */
export function useInputCommon<T>(args: CommonInputArgs<T>): CommonInput<T> {
  const fieldCtl = args.field ? resolveFieldBinding(args.field) : null;

  const focused = state(false);

  const readError = (): string | undefined => {
    const e = args.error;
    if (typeof e === "function") return e();
    if (e !== undefined) return e;
    return fieldCtl?.error();
  };
  const hasError = (): boolean => !!readError();

  const errorText = state("");
  watch(() => {
    errorText(readError() ?? "");
  });

  /**
   * Risolve `bg`:
   *  - se è un token noto (`background`/`secondary`/`primary`/`error`) →
   *    `var(--<token>)`, così `bg="background"` funziona come atteso.
   *  - altrimenti lascia com'è (`#fff`, `var(--foo)`, `rgb(...)` ecc.).
   */
  const mapBg = (v: string | undefined): string | undefined => {
    if (v === undefined) return undefined;
    if (/^(background|secondary|primary|error)$/.test(v)) return `var(--${v})`;
    return v;
  };
  const resolvedBg = (): string =>
    mapBg(args.bg) ?? mapBg(fieldCtl?.bg()) ?? "var(--secondary, #121212)";

  const isOptional = (): boolean => !!fieldCtl?.optional();
  const meta = (): FieldTypeDesc | undefined => fieldCtl?.meta();

  const read = (): T | undefined => {
    if (fieldCtl) return args.fromString(fieldCtl.get());
    return args.readExternal();
  };

  const write = (v: T | undefined): void => {
    if (fieldCtl) fieldCtl.setRaw(v);
  };

  const m = () => inputMetrics(args.size);

  return {
    m,
    focused,
    readError,
    hasError,
    errorText,
    resolvedBg,
    isOptional,
    meta,
    read,
    write,
  };
}
