import { state, watch } from "client";
import {
  resolveFieldBinding,
  type FieldBinding,
} from "../../../../../../core/client/form/form";
import type { InputPropsBase } from "./index";
import { inputMetrics } from "./sizes";
import {
  mapColorToken,
  optionalFieldMutedColor,
  resolvePalette,
  inputSurfaceBg,
  inputCutoutBackground,
  inputRequiredRestingBorderColor,
  formModeShellScopeVars,
} from "./presets";
import { logInputDebug } from "./inputDebug";

/**
 * Props specifiche per `<Input type="string">`.
 * Binding tramite `value`+`input` oppure `field` (ritornato da `Form({...}).fieldName`).
 * Quando viene passato `field`, l'errore di validazione viene letto automaticamente
 * dal form: **non serve passare anche `error` manualmente**.
 */
export type InputStringProps = InputPropsBase & {
  value?: string | (() => string);
  input?: (value: string) => void;
  change?: (value: string) => void;
  blur?: (value: string) => void;
  /** Binding al campo di un `Form({...})`. Se presente, l'errore è automatico. */
  field?: FieldBinding;
  /**
   * Override manuale del messaggio d'errore. In genere non necessario
   * quando si usa `field`: l'errore è già reattivo dal form.
   * Accetta stringa statica o funzione reattiva.
   */
  error?: string | undefined | (() => string | undefined);
  maxLength?: number;
  autocomplete?: string;
};

/**
 * UI "premium iOS-like" con **box pieno + floating label + error inline**.
 *  - bordo pieno sottile
 *  - focus ring morbido (ombra tenue color primary)
 *  - label floating che si sposta sul bordo superiore "tagliandolo"
 *  - stato error: bordo/label/testo/ring rossi, messaggio inline sotto
 *  - l'errore è letto automaticamente dal `field` se presente
 */
export default function InputString({
  size = 3,
  placeholder,
  disabled,
  autofocus,
  value,
  input,
  change,
  blur,
  field,
  error,
  maxLength,
  autocomplete,
  bg: bgProp,
  accentColor,
  restingColor,
  showFocusShadow,
  borderWidth,
  round,
  mode,
}: InputStringProps) {
  const focused = state(false);
  /** Stato locale per input non controllati (senza `field`). */
  const localHasValue = state(false);

  /**
   * Risolve l'errore corrente in 3 step:
   *  1. prop `error` esplicita (string o funzione)
   *  2. `field.error()` se c'è un form binding
   *  3. undefined
   */
  const fieldCtl = field ? resolveFieldBinding(field) : null;
  let stringInputEl: HTMLInputElement | null = null;
  const readError = (): string | undefined => {
    if (typeof error === "function") return error();
    if (error !== undefined) return error;
    return fieldCtl?.error();
  };
  const hasError = () => !!readError();

  /**
   * `bg` da usare per "tagliare" il bordo con label/errore. Priorità:
   *  1. prop `bg` esplicita sull'Input
   *  2. `bg` del Form (propagato via `field`) → così basta settarlo una volta su `Form({ bg: ... })`
   *  3. fallback `var(--secondary)`
   */
  const resolvedBg = (): string =>
    mapColorToken(bgProp) ??
    mapColorToken(fieldCtl?.bg()) ??
    (() => {
      const explicitMode = mode ?? fieldCtl?.style()?.mode;
      if (explicitMode !== undefined) return inputSurfaceBg(explicitMode);
      return "var(--fw-popmenu-bg, var(--secondary, #121212))";
    })();

  /** `optional` auto-rilevato dallo schema del field (es. `v.string().optional()`). */
  const isOptional = (): boolean => !!fieldCtl?.optional();

  /**
   * Palette reattiva: unisce i default del preset (`mode`), l'override del
   * `Form` (via `field.style()`) e le prop puntuali passate all'`<Input>`.
   * Le prop puntuali vincono sempre.
   */
  const palette = () => {
    const fs = fieldCtl?.style();
    return resolvePalette({
      mode: mode ?? fs?.mode,
      accentColor: accentColor ?? fs?.accentColor,
      restingColor: restingColor ?? fs?.restingColor,
      showFocusShadow:
        showFocusShadow !== undefined ? showFocusShadow : fs?.showFocusShadow,
    });
  };
  const borderWidthCss = (): string => {
    const fs = fieldCtl?.style();
    const raw = borderWidth ?? fs?.borderWidth ?? 2;
    return typeof raw === "number" ? `${raw}px` : raw;
  };
  const roundCss = (): string => {
    const fs = fieldCtl?.style();
    const raw = round ?? fs?.round;
    if (raw !== undefined) return typeof raw === "number" ? `${raw}px` : raw;
    return `var(--inputRound, var(--round, ${m().radius}))`;
  };

  /**
   * `hasValue` reattivo: se c'è `field`, lo leggo dal controller (tracciato
   * perché `ctl.get()` invoca la signal del campo). Altrimenti uso `localHasValue`
   * aggiornato dagli handler `input`/`blur`.
   */
  const hasValue = (): boolean => {
    if (fieldCtl) return fieldCtl.get().length > 0;
    return localHasValue();
  };
  const isFloating = () => focused() || hasValue();

  const onInputChanged = (v: string) => {
    localHasValue(v.length > 0);
    input?.(v);
  };

  /**
   * Signal reattiva col testo d'errore: il framework renderizza come testo
   * solo `Signal` e nodi DOM, non funzioni. Quindi mantengo una `state()`
   * aggiornata via `watch` ogni volta che cambia `readError()`.
   */
  const errorText = state("");
  watch(() => {
    errorText(readError() ?? "");
  });

  /**
   * Metriche reattive (cambiano automaticamente al resize mob↔tab↔des).
   * Centralizzate in `clientConfig.input[size]` per coerenza su tutto il framework.
   */
  const m = () => inputMetrics(size);

  /**
   * Wrapper: `relative` per ospitare la label floating e il messaggio
   * d'errore (entrambi `position: absolute`, quindi a cavallo del bordo).
   * Nessun `paddingBottom` riservato: il wrapper è alto esattamente quanto
   * il box visibile, così in una `col gapy-X` il ritmo verticale dipende
   * solo dal `gap` del parent e risulta uniforme anche quando sotto c'è
   * un `<Input type="number">` (che non ha questo padding).
   */
  const wrapStyle = (): Record<string, string> => ({
    position: "relative",
    display: "inline-block",
    width: "100%",
    opacity: disabled ? "0.5" : "1",
    pointerEvents: disabled ? "none" : "auto",
    ...formModeShellScopeVars(mode ?? fieldCtl?.style()?.mode),
  });

  /**
   * Stile input: box pieno con **bordo sottile neutro sempre uguale**, e
   * feedback di focus/error solo via `box-shadow` (glow/alone tutt'attorno).
   * Questo evita il doppio bordo: il border resta sempre identico, cambia solo
   * l'alone esterno → effetto iOS "glow" pulito.
   */
  /**
   * Stile input:
   *  - bordo: error=rosso, focus/valore=primary, altrimenti grigio tenue.
   *  - shadow: **solo in focus** (blur 5px, primary intensa, poco dispersa).
   *  - text color: rosso in error, bianco altrimenti.
   */
  const inputStyle = (): Record<string, string> => {
    const err = !!readError();
    const foc = focused();
    const hv = hasValue();
    const met = m();
    const pal = palette();
    const optAtRest =
      isOptional() &&
      !foc &&
      !hv &&
      !err &&
      restingColor === undefined;
    const borderColor = err
      ? "var(--error)"
      : optAtRest
        ? optionalFieldMutedColor()
        : foc
          ? pal.accent
          : isOptional()
            ? pal.restingBorder
            : inputRequiredRestingBorderColor();
    const ring =
      pal.showFocusShadow && foc && !err
        ? `0 0 5px 0 ${pal.accent}`
        : "0 0 0 0 rgba(0,0,0,0)";
    return {
      width: "100%",
      padding: `${met.padY} ${met.padX}`,
      fontSize: met.font,
      fontWeight: "500",
      lineHeight: "1.35",
      background: "transparent",
      color: err ? "var(--error)" : pal.text,
      border: `${borderWidthCss()} solid ${borderColor}`,
      borderRadius: roundCss(),
      outline: "none",
      WebkitAppearance: "none",
      boxShadow: ring,
      transition:
        "box-shadow 220ms cubic-bezier(0.2, 0.8, 0.2, 1), " +
        "border-color 180ms ease, " +
        "color 180ms ease, " +
        "caret-color 180ms ease",
      caretColor: err ? "var(--error)" : pal.accent,
    };
  };

  /**
   * Label floating (solo verticale + leggera scala): a riposo scale 1.12 dentro
   * al box; floating `translateY(-50%)` scale 1 sul bordo superiore.
   */
  const labelStyle = (): Record<string, string> => {
    const floating = isFloating();
    const err = hasError();
    const foc = focused();
    const hv = hasValue();
    const met = m();
    const cut = inputCutoutBackground(resolvedBg());
    const pal = palette();
    const optAtRest =
      isOptional() &&
      !foc &&
      !hv &&
      !err &&
      restingColor === undefined;
    const color = err
      ? "var(--error)"
      : optAtRest
        ? optionalFieldMutedColor()
        : foc || hv
          ? pal.accent
          : pal.labelResting;
    const scale = floating ? 1 : 1.12;
    const translate = floating ? "translateY(-50%)" : "translateY(0)";
    return {
      position: "absolute",
      left: `calc(${met.padX} - 0.25rem)`,
      top: "0",
      /**
       * A riposo: `bottom: 0` → area = intero box del wrapper (che ora non
       * ha più `paddingBottom` riservato all'errore). Così il flex centra il
       * placeholder esattamente sulla baseline dell'input, senza quel
       * "margin virtuale" sotto che si vedeva quando invece ritagliavamo
       * l'area lasciando fuori un padding inesistente.
       * Floating: `bottom: auto` → si aggancia solo a `top: 0`.
       */
      bottom: floating ? "auto" : "0",
      display: "flex",
      alignItems: "center",
      transform: `${translate} scale(${scale})`,
      transformOrigin: "left center",
      paddingLeft: "0.4rem",
      paddingRight: "0.4rem",
      fontSize: met.labelFloating,
      fontWeight: floating ? "600" : "500",
      letterSpacing: floating ? "0.02em" : "0",
      color,
      background: floating ? cut : "transparent",
      pointerEvents: "none",
      whiteSpace: "nowrap",
      lineHeight: "1",
      transition:
        "bottom 260ms cubic-bezier(0.2, 0.8, 0.2, 1), " +
        "transform 260ms cubic-bezier(0.2, 0.8, 0.2, 1), " +
        "font-weight 200ms ease, " +
        "letter-spacing 200ms ease, " +
        "color 220ms ease, " +
        "background-color 200ms ease",
    };
  };

  /**
   * Mini-etichetta "opzionale" a cavallo del bordo superiore DESTRO, mostrata
   * automaticamente quando lo schema del field è `.optional()`. Serve a non
   * ripetere "(opz.)" nel placeholder: basta `v.string().optional()`.
   */
  const optionalStyle = (): Record<string, string> => {
    const met = m();
    const cut = inputCutoutBackground(resolvedBg());
    const pal = palette();
    return {
      position: "absolute",
      right: `calc(${met.padX} - 0.25rem)`,
      top: "0",
      transform: "translateY(-50%)",
      paddingLeft: "0.4rem",
      paddingRight: "0.4rem",
      fontSize: met.labelFloating,
      fontWeight: "500",
      letterSpacing: "0.02em",
      color: pal.optionalColor,
      background: cut,
      lineHeight: "1",
      pointerEvents: "none",
      whiteSpace: "nowrap",
    };
  };

  /**
   * Messaggio d'errore: **centrato** a cavallo del bordo inferiore (orizz. al
   * 50% del box). `bg` del contenitore "taglia" il bordo sotto al testo.
   */
  const errorStyle = (): Record<string, string> => {
    const err = !!readError();
    const cut = inputCutoutBackground(resolvedBg());
    const met = m();
    return {
      position: "absolute",
      left: "50%",
      // Con il wrapper senza `paddingBottom`, il bordo inferiore del box
      // coincide con il fondo del wrapper: `bottom: 0` + `translateY(50%)`
      // piazza il testo a cavallo del bordo (metà sopra, metà sotto).
      bottom: "0",
      transform: err
        ? "translate(-50%, 50%)"
        : "translate(-50%, calc(50% - 4px))",
      paddingLeft: "0.5rem",
      paddingRight: "0.5rem",
      fontSize: met.labelFloating,
      fontWeight: "600",
      color: "var(--error)",
      letterSpacing: "0.02em",
      lineHeight: "1",
      background: err ? cut : "transparent",
      opacity: err ? "1" : "0",
      transition:
        "opacity 180ms ease, " +
        "transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1), " +
        "background-color 180ms ease",
      pointerEvents: "none",
      whiteSpace: "nowrap",
      textAlign: "center",
    };
  };

  const debugName = field?.field ?? "no-field";
  watch(() => {
    const fs = fieldCtl?.style();
    const pal = palette();
    const err = !!readError();
    const foc = focused();
    const hv = hasValue();
    const optAtRest =
      isOptional() &&
      !foc &&
      !hv &&
      !err &&
      restingColor === undefined;
    const borderColor = err
      ? "var(--error)"
      : optAtRest
        ? optionalFieldMutedColor()
        : foc
          ? pal.accent
          : isOptional()
            ? pal.restingBorder
            : inputRequiredRestingBorderColor();
    const borderReason = err
      ? "error"
      : optAtRest
        ? "optionalAtRest→inputOptionalMuted (spesso bordo grigio chiaro)"
        : foc
          ? "focus→accent"
          : isOptional()
            ? "optional→restingBorder"
            : "requiredResting→inputDark";
    const st = inputStyle();
    const effectiveMode = mode ?? fs?.mode;
    queueMicrotask(() => {
      let dom: Record<string, string> | null = null;
      if (stringInputEl && typeof getComputedStyle !== "undefined") {
        const c = getComputedStyle(stringInputEl);
        dom = {
          borderTopColor: c.borderTopColor,
          borderTopWidth: c.borderTopWidth,
          color: c.color,
          backgroundColor: c.backgroundColor,
        };
      }
      logInputDebug(`[InputStyleTrace string · ${debugName}]`, {
        variant: "string",
        field: debugName,
        explicitInputMode: mode,
        inheritedFormMode: fs?.mode,
        effectiveMode,
        formStyleFromField: fs,
        resolvePaletteInput: {
          mode: mode ?? fs?.mode,
          accentColor: accentColor ?? fs?.accentColor,
          restingColor: restingColor ?? fs?.restingColor,
          showFocusShadow:
            showFocusShadow !== undefined
              ? showFocusShadow
              : fs?.showFocusShadow,
        },
        isOptional: isOptional(),
        state: { err, focus: foc, hasValue: hv, optAtRest },
        borderReason,
        borderColorResolved: borderColor,
        optionalMuted: optionalFieldMutedColor(),
        fullPalette: {
          accent: pal.accent,
          restingBorder: pal.restingBorder,
          hoverBorder: pal.hoverBorder,
          text: pal.text,
          labelResting: pal.labelResting,
          optionalColor: pal.optionalColor,
          stepperMinusRgb: pal.stepperMinusRgb,
          stepperPlusRgb: pal.stepperPlusRgb,
          stepperResting: pal.stepperResting,
          showFocusShadow: pal.showFocusShadow,
        },
        fullInputStyle: st,
        surfaceFromFormOrMode: effectiveMode !== undefined ? inputSurfaceBg(effectiveMode) : undefined,
        domComputed: dom,
      });
    });
  });

  return (
    <div style={wrapStyle as any}>
      <input
        type="text"
        placeholder=""
        disabled={disabled}
        autofocus={autofocus}
        maxLength={maxLength as any}
        autocomplete={autocomplete}
        bind={field}
        value={value as any}
        input={onInputChanged}
        change={change}
        focus={() => focused(true)}
        blur={(v: string) => {
          focused(false);
          localHasValue(v.length > 0);
          blur?.(v);
        }}
        ref={(el: HTMLInputElement | null) => {
          stringInputEl = el;
        }}
        style={inputStyle as any}
      />

      {placeholder ? (
        <div style={labelStyle as any}>{placeholder}</div>
      ) : null}

      {isOptional() ? (
        <div style={optionalStyle as any}>opzionale</div>
      ) : null}

      <div style={errorStyle as any}>{errorText}</div>
    </div>
  );
}
