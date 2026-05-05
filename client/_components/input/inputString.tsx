import { icon, state, watch } from "client";
import { isSignal } from "../../../core/client/state";
import {
  resolveFieldBinding,
  type FieldBinding,
} from "../../../core/client/form/form";
import type { InputPropsBase } from "./index";
import { inputMetrics } from "./sizes";
import {
  mapColorToken,
  optionalFieldMutedColor,
  resolvePalette,
  inputSurfaceBg,
  inputCutoutBackground,
  formModeShellScopeVars,
  isNoneInputMode,
} from "./presets";
import { INPUT_DEBUG, logInputDebug } from "./inputDebug";
import { pickInputElementDom } from "./common";
import { roundingRef } from "../../_utils/rounding";

/**
 * Props specifiche per `<Input type="string">`.
 * Binding tramite `value`+`input` oppure `field` (ritornato da `Form({...}).fieldName`).
 * Quando viene passato `field`, l'errore di validazione viene letto automaticamente
 * dal form: **non serve passare anche `error` manualmente**.
 */
export type InputStringProps = InputPropsBase & {
  value?: string | (() => string);
  /** Valore iniziale se non usi `field` né `value` (input non controllato). */
  defaultValue?: string | number;
  input?: (value: string) => void;
  change?: (value: string) => void;
  /** Alla `blur` nativa: valore (string) e opzionalmente l’evento, come sull'`<input>` del framework. */
  blur?: (value: string, ev?: Event) => void;
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
  /**
   * Stesso stile e behaviour di un input testo, con `type` password, toggle
   * visibilità (occhio) e spazio a destra per l’icona. Si usa con
   * `<Input type="password" />` o con `v.password()` nel form (inferito).
   */
  passwordMode?: boolean;
  /**
   * Normalizzazione spazi: in digitazione niente doppi spazi; in `blur` anche `trimEnd()`.
   * Default: **attivo** sugli input testo, **spento** su `passwordMode` (password libere).
   * Passa `squeezeSpaces={false}` per disattivare su testo, o `true` per forzare su password.
   */
  squeezeSpaces?: boolean;
};

/**
 * UI "premium iOS-like" con **box pieno + floating label + error inline**.
 *  - bordo pieno sottile
 *  - focus ring morbido (ombra tenue color primary)
 *  - label floating che si sposta sul bordo superiore "tagliandolo"
 *  - stato error: bordo/label/testo/ring rossi, messaggio inline sotto
 *  - l'errore è letto automaticamente dal `field` se presente
 */
export default function InputString(props: InputStringProps) {
  const {
    size = 3,
    placeholder,
    disabled,
    autofocus,
    value,
    defaultValue,
    input,
    change,
    blur,
    field,
    error,
    maxLength,
    autocomplete,
    passwordMode = false,
    squeezeSpaces: squeezeSpacesProp,
    bg: bgProp,
    accentColor,
    focusColor,
    restingColor,
    showFocusShadow,
    borderWidth,
    round,
    mode,
    focus: userFocus,
    focusout: userFocusOut,
    s: sProp,
    sInput: sInputProp,
    style: userStyleProp,
  } = props;
  const squeezeSpaces = squeezeSpacesProp ?? !passwordMode;
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
  const noneMode = isNoneInputMode(mode ?? fieldCtl?.style()?.mode);
  let stringInputEl: HTMLInputElement | null = null;
  let eyeShownEl: Element | null = null;
  let eyeHiddenEl: Element | null = null;
  /**
   * Visibilità password: `let` imperativo (tipo + icone). Il `style={inputStyle}` è
   * in un `watch` che *non* si riallinea al solo `let`, quindi incrementiamo un
   * segnale contatore per far ricalcolare letter-spacing / font mascherati.
   */
  let passwordShown = false;
  const passwordStyleNonce = state(0);
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
      focusColor: focusColor ?? fs?.focusColor,
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
    return `var(--roundPx, var(--round, ${m().radius}))`;
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
    let next = v;
    if (squeezeSpaces && stringInputEl) {
      const el = stringInputEl;
      const squeezed = v.replace(/ {2,}/g, " ");
      if (squeezed !== v) {
        const a = el.selectionStart ?? 0;
        const b = el.selectionEnd ?? 0;
        el.value = squeezed;
        const start = v.slice(0, a).replace(/ {2,}/g, " ").length;
        const end = v.slice(0, b).replace(/ {2,}/g, " ").length;
        el.setSelectionRange(start, end);
        next = squeezed;
      }
    }
    localHasValue(next.length > 0);
    input?.(next);
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

  const logPw = (msg: string, extra?: Record<string, unknown>) => {
    if (!passwordMode) return;
    const payload = {
      field: field?.field ?? "no-field",
      shown: passwordShown,
      inputType: stringInputEl?.type,
      disabled: !!disabled,
      ...extra,
    };
    console.log(`[input.password] ${msg}`, payload);
  };

  const setNodeDisplay = (el: Element | null, display: string): void => {
    if (!el) return;
    (el as HTMLElement | SVGElement).style.display = display;
  };

  /**
   * Metriche reattive (cambiano automaticamente al resize mob↔tab↔des).
   * Centralizzate in `clientConfig.input[size]` per coerenza su tutto il framework.
   */
  const m = () => inputMetrics(size);

  /** Bordo e alone focus: condiviso tra input testo, shell password e campo interno. */
  const fieldChrome = () => {
    const err = !!readError();
    const foc = focused();
    const hv = hasValue();
    const met = m();
    const pal = palette();
    const fs = fieldCtl?.style();
    const hasRestingOverride =
      restingColor !== undefined || fs?.restingColor !== undefined;
    const optAtRest =
      isOptional() &&
      !foc &&
      !hv &&
      !err &&
      !hasRestingOverride;
    const borderColor = err
      ? "var(--error)"
      : optAtRest
        ? optionalFieldMutedColor()
        : foc
          ? pal.accent
          : pal.restingBorder;
    const ring =
      pal.showFocusShadow && foc && !err
        ? `0 0 5px 0 ${pal.accent}`
        : "0 0 0 0 rgba(0,0,0,0)" as const;
    return { err, foc, met, pal, optAtRest, borderColor, ring, hv };
  };

  /**
   * Wrapper: `relative` per ospitare la label floating e il messaggio
   * d'errore (entrambi `position: absolute`, quindi a cavallo del bordo).
   * Nessun `paddingBottom` riservato: il wrapper è alto esattamente quanto
   * il box visibile, così in una `col gapy-X` il ritmo verticale dipende
   * solo dal `gap` del parent e risulta uniforme anche quando sotto c'è
   * un `<Input type="number">` (che non ha questo padding).
   */
  const wrapStyle = (): Record<string, string> =>
    noneMode
      ? {
          position: "relative",
          /** `block` + `minWidth` 0 evita shrink-wrap (flex): altrimenti l’ `<input>` al 100% resta largo solo “al testo”. */
          display: "block",
          width: "100%",
          minWidth: "0",
          opacity: disabled ? "0.5" : "1",
          pointerEvents: disabled ? "none" : "auto",
        }
      : {
          position: "relative",
          display: "inline-block",
          width: "100%",
          opacity: disabled ? "0.5" : "1",
          pointerEvents: disabled ? "none" : "auto",
          ...formModeShellScopeVars(mode ?? fieldCtl?.style()?.mode),
        };

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
    void passwordStyleNonce();
    const masked = passwordMode && !passwordShown;
    if (noneMode) {
      /**
       * Nessun `fieldChrome()` qui: altrimenti si legge `focused()` e il watch su `style`
       * riesegue al focus, reimpostando `padding: "0"` e cancellando py/px da `s` (longhand).
       */
      const met = m();
      const err = hasError();
      const textMetrics =
        passwordMode && masked
          ? {
              fontSize: `calc(${met.font} + 2px)`,
              fontWeight: "600" as const,
              letterSpacing: "0.22em",
            }
          : {
              fontSize: met.font,
              fontWeight: "500" as const,
              ...(passwordMode && passwordShown ? { letterSpacing: "normal" as const } : {}),
            };
      const out: Record<string, string> = {
        position: "relative",
        width: "100%",
        minWidth: "0",
        boxSizing: "border-box",
        margin: "0",
        ...textMetrics,
        lineHeight: "inherit",
        background: "transparent",
        color: err ? "var(--error)" : "inherit",
        border: "none",
        borderRadius: "0",
        outline: "none",
        WebkitAppearance: "none",
        boxShadow: "none",
        caretColor: err ? "var(--error)" : "currentColor",
        fontFamily: "inherit",
      };
      if (passwordMode) {
        out.padding = `0 calc(${met.padX} + 1.7rem) 0 ${met.padX}`;
      } else {
        /** Inset da `s`/padding sul guscio (`mode none` come date/time). */
        out.padding = "0";
      }
      return out;
    }
    const { err, met, pal, borderColor, ring } = fieldChrome();
    const textMetrics =
      passwordMode && masked
        ? {
            fontSize: `calc(${met.font} + 2px)`,
            fontWeight: "600" as const,
            letterSpacing: "0.22em",
          }
        : {
            fontSize: met.font,
            fontWeight: "500" as const,
            ...(passwordMode && passwordShown ? { letterSpacing: "normal" as const } : {}),
          };
    return {
      position: "relative",
      width: "100%",
      padding: passwordMode
        ? `${met.padY} calc(${met.padX} + 1.7rem) ${met.padY} ${met.padX}`
        : `${met.padY} ${met.padX}`,
      ...textMetrics,
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
      right: isOptional() && passwordMode
        ? `calc(${met.padX} + 1.65rem)`
        : `calc(${met.padX} - 0.25rem)`,
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
  if (INPUT_DEBUG) watch(() => {
    const fs = fieldCtl?.style();
    const pal = palette();
    const err = !!readError();
    const foc = focused();
    const hv = hasValue();
    const hasRestingOverride =
      restingColor !== undefined || fs?.restingColor !== undefined;
    const optAtRest =
      isOptional() &&
      !foc &&
      !hv &&
      !err &&
      !hasRestingOverride;
    const borderColor = err
      ? "var(--error)"
      : optAtRest
        ? optionalFieldMutedColor()
        : foc
          ? pal.accent
          : pal.restingBorder;
    const borderReason = err
      ? "error"
      : optAtRest
        ? "optionalAtRest→inputOptionalMuted (spesso bordo grigio chiaro)"
        : foc
          ? "focus→accent"
          : "resting→pal.restingBorder";
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
        variant: passwordMode ? "password" : "string",
        field: debugName,
        explicitInputMode: mode,
        inheritedFormMode: fs?.mode,
        effectiveMode,
        formStyleFromField: fs,
        resolvePaletteInput: {
          mode: mode ?? fs?.mode,
          accentColor: accentColor ?? fs?.accentColor,
          focusColor: focusColor ?? fs?.focusColor,
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

  const passwordToggleStyle = (): Record<string, string> => {
    const { borderColor } = fieldChrome();
    return {
      position: "absolute",
      right: "0.45rem",
      top: "50%",
      transform: "translateY(-50%)",
      zIndex: "40",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      width: "1.8rem",
      height: "1.8rem",
      padding: "0",
      borderRadius: roundCss(),
      cursor: disabled ? "default" : "pointer",
      /** Stesso colore del bordo del campo: a riposo = resting (o muted se opzionale), a focus = accent. */
      color: borderColor,
      opacity: disabled ? "0.4" : "1",
      userSelect: "none",
      touchAction: "manipulation" as const,
      pointerEvents: "auto" as const,
    };
  };

  const resolvedAutocomplete =
    autocomplete !== undefined
      ? autocomplete
      : passwordMode
        ? "current-password"
        : undefined;

  const domPass = pickInputElementDom(props as Record<string, unknown>, new Set(["pointerdown"]));
  const userPointerDown = (props as { pointerdown?: (e: PointerEvent) => void }).pointerdown;

  const resolveUserInline = (): Record<string, string | number> | undefined => {
    const u = userStyleProp;
    if (u == null || u === false) return undefined;
    let v: unknown;
    if (typeof u === "function") v = (u as () => unknown)();
    else if (isSignal(u)) v = u();
    else v = u;
    if (v == null || v === false) return undefined;
    return v as Record<string, string | number>;
  };

  const mergedInputStyle = (): Record<string, string | number> => {
    const base = inputStyle();
    const extra = resolveUserInline();
    if (!extra) return base;
    return { ...base, ...extra };
  };

  const togglePasswordVisibility = (e: Event): void => {
    const targetTag = (e.target as HTMLElement | null)?.tagName;
    const currentTag = (e.currentTarget as HTMLElement | null)?.tagName;
    logPw("toggle: event", {
      eventType: e.type,
      targetTag,
      currentTag,
    });
    e.stopPropagation();
    if (typeof (e as { preventDefault?: () => void }).preventDefault === "function") {
      (e as { preventDefault: () => void }).preventDefault();
    }
    if (disabled) {
      logPw("toggle: blocked-disabled");
      return;
    }
    const next = !passwordShown;
    logPw("toggle: set-state", { nextShown: next });
    passwordShown = next;
    passwordStyleNonce((n) => n + 1);
    if (stringInputEl) {
      const t = next ? "text" : "password";
      if (stringInputEl.type !== t) stringInputEl.type = t;
    }
    setNodeDisplay(eyeShownEl, next ? "none" : "contents");
    setNodeDisplay(eyeHiddenEl, next ? "contents" : "none");
    queueMicrotask(() => {
      logPw("toggle: microtask-after", { expectedShown: next });
    });
  };

  return (
    <div
      class="Input"
      data-rounding=""
      style={wrapStyle as any}
      s={sProp as any}
      ref={roundingRef({ applyBorderRadius: false })}
    >
      <input
        {...domPass}
        type={passwordMode ? "password" : "text"}
        placeholder={noneMode ? (placeholder ?? "") : ""}
        disabled={disabled}
        autofocus={autofocus}
        maxLength={maxLength as any}
        autocomplete={resolvedAutocomplete as any}
        spellcheck={passwordMode ? false : undefined}
        bind={field}
        value={
          field
            ? (value as any)
            : typeof value === "function"
              ? undefined
              : (value as any)
        }
        defaultValue={
          field != null ||
          value !== undefined ||
          typeof value === "function"
            ? undefined
            : defaultValue !== undefined
              ? defaultValue
              : undefined
        }
        input={onInputChanged}
        change={change}
        focusout={userFocusOut}
        pointerdown={(e: PointerEvent) => {
          logPw("input:pointerdown", {
            targetTag: (e.target as HTMLElement | null)?.tagName,
          });
          userPointerDown?.(e);
        }}
        focus={(e: FocusEvent) => {
          focused(true);
          const f = userFocus;
          if (typeof f === "function") void f(e);
        }}
        blur={(v: string, ev?: Event) => {
          focused(false);
          let out = v;
          if (squeezeSpaces) {
            out = v.trimEnd();
            if (out !== v && stringInputEl) stringInputEl.value = out;
          }
          localHasValue(out.length > 0);
          blur?.(out, ev);
        }}
        ref={(el: HTMLInputElement | null) => {
          stringInputEl = el;
          if (el && passwordMode) {
            el.type = passwordShown ? "text" : "password";
          }
        }}
        style={mergedInputStyle as any}
        s={sInputProp as any}
      />

      {!noneMode && placeholder ? (
        <div style={labelStyle as any}>{placeholder}</div>
      ) : null}

      {!noneMode && isOptional() ? (
        <div style={optionalStyle as any}>opzionale</div>
      ) : null}

      {passwordMode ? (
        <div
          style={passwordToggleStyle as any}
          tabIndex={disabled ? -1 : 0}
          role="button"
          title="Mostra o nascondi password"
          click={togglePasswordVisibility}
          pointerup={(e: PointerEvent) => {
            logPw("toggle:pointerup", {
              targetTag: (e.target as HTMLElement | null)?.tagName,
            });
          }}
        >
          <div
            ref={(el: Element | null) => {
              eyeShownEl = el;
            }}
            style={{ display: "contents" } as any}
          >
            <icon name="eye" size={5} />
          </div>
          <div
            ref={(el: Element | null) => {
              eyeHiddenEl = el;
            }}
            style={{ display: "none" } as any}
          >
            <icon name="eyeClosed" size={5} />
          </div>
        </div>
      ) : null}

      <div style={errorStyle as any}>{errorText}</div>
    </div>
  );
}
