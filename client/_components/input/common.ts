import { state, watch } from "client";
import type { ClientEvents } from "../../../core/client/runtime/tag/props";
import { CLIENT_EVENT_NAMES } from "../../../core/client/runtime/tag/props";
import {
  resolveFieldBinding,
  type FieldBinding,
  type FormStyle,
} from "../../../core/client/form/form";
import type { FieldTypeDesc } from "../../../core/client/validator/field-meta";
import { inputMetrics } from "./sizes";
import type { InputSize } from "./index";
import {
  mapColorToken,
  inputSurfaceBg,
  resolvePalette,
  type InputMode,
  type InputPalette,
} from "./presets";

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
  /** Override mode del preset (auto/dark/light). Se assente, eredita dal form. */
  mode?: InputMode;
  /** Override colore accent (focus). Se assente, eredita dal form o dal preset. */
  accentColor?: string;
  /** Override bordo a focus; su Form è `focusColor`. `accentColor` vince se entrambi. */
  focusColor?: string;
  /** Override colore resting (no focus). Se assente, eredita dal form o dal preset. */
  restingColor?: string;
  /** Override shadow di focus. Se assente, eredita dal form o dal preset. */
  showFocusShadow?: boolean;
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
  focused: {
    (): boolean;
    (value: boolean): void;
  };
  /** Errore corrente (reattivo). `undefined` se valido. */
  readError: () => string | undefined;
  /** `true` se c'è un errore. */
  hasError: () => boolean;
  /** Signal testuale dell'errore (comoda per renderizzare direttamente). */
  errorText: {
    (): string;
    (value: string): void;
  };
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
  /**
   * Palette risolta (preset + override prop + override form). Reattiva nel
   * senso che viene ricalcolata a ogni render che la invoca.
   */
  palette: () => InputPalette;
  /** Stile del form (se presente). Reattivo via `field.style()`. */
  formStyle: () => FormStyle | undefined;
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

  const resolvedBg = (): string =>
    mapColorToken(args.bg) ??
    mapColorToken(fieldCtl?.bg()) ??
    (() => {
      const explicitMode = args.mode ?? formStyle()?.mode;
      if (explicitMode !== undefined) return inputSurfaceBg(explicitMode);
      return "var(--fw-popmenu-bg, var(--secondary, #121212))";
    })();

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

  const formStyle = (): FormStyle | undefined => fieldCtl?.style();

  const palette = (): InputPalette => {
    const fs = formStyle();
    return resolvePalette({
      mode: args.mode ?? fs?.mode,
      accentColor: args.accentColor ?? fs?.accentColor,
      focusColor: args.focusColor ?? fs?.focusColor,
      restingColor: args.restingColor ?? fs?.restingColor,
      showFocusShadow:
        args.showFocusShadow !== undefined
          ? args.showFocusShadow
          : fs?.showFocusShadow,
    });
  };

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
    palette,
    formStyle,
  };
}

/**
 * Nomi evento DOM inoltrabili sull'`<input>` (stessi key degli elementi del framework, minuscolo).
 * Esclude `input`/`change` (gestione valore) e `focus`/`blur`/`focusout` (merge con stato interno).
 */
export const INPUT_ELEMENT_DOM_KEYS = [
	"click",
	"dblclick",
	"contextmenu",
	"keydown",
	"keyup",
	"focusin",
	"pointerdown",
	"pointerup",
	"pointerenter",
	"pointerleave",
	"pointermove",
	"pointercancel",
	"mousedown",
	"mouseup",
	"mouseenter",
	"mouseleave",
	"mousemove",
	"touchstart",
	"touchend",
	"touchmove",
	"scroll",
	"wheel",
] as const satisfies readonly (typeof CLIENT_EVENT_NAMES)[number][];

export type InputElementDom = Pick<ClientEvents, (typeof INPUT_ELEMENT_DOM_KEYS)[number]>;

type DomKey = (typeof INPUT_ELEMENT_DOM_KEYS)[number];

/** Copia da `p` solo le callback DOM elencate in `INPUT_ELEMENT_DOM_KEYS` (e opz. esclusi i nomi in `skip`). */
export function pickInputElementDom(
	p: Record<string, unknown>,
	skip?: ReadonlySet<DomKey>,
): Record<string, unknown> {
	const o: Record<string, unknown> = {};
	for (const k of INPUT_ELEMENT_DOM_KEYS) {
		if (skip?.has(k)) continue;
		if (k in p && p[k] !== undefined) o[k] = p[k];
	}
	return o;
}
