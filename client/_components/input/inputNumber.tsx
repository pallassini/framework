import { state, watch } from "client";
import { type FieldBinding } from "../../../core/client/form/form";
import type { InputPropsBase } from "./index";
import { useInputCommon, pickInputElementDom } from "./common";
import {
  inputSurfaceBg,
  inputCutoutBackground,
  inputRequiredRestingBorderColor,
  formModeShellScopeVars,
  mapColorToken,
  optionalFieldMutedColor,
} from "./presets";
import { logInputDebug } from "./inputDebug";

/**
 * `<Input type="number">` — scheletro.
 * Espone una signal `value: number | undefined` **già sincronizzata** col
 * field/value esterno. Tutto il resto (UI, +/−, validazione, placeholder)
 * lo costruisci nel JSX qui sotto.
 */
export type InputNumberProps = InputPropsBase & {
  value?: number | (() => number);
  input?: (value: number | undefined) => void;
  change?: (value: number | undefined) => void;
  blur?: (value: number | undefined) => void;
  field?: FieldBinding;
  error?: string | undefined | (() => string | undefined);
  min?: number;
  max?: number;
  step?: number;
  /**
   * Se `true` accetta solo interi. Derivata automaticamente da `v.number().int()`
   * sullo schema del `field`: di solito non serve passarla a mano.
   */
  integer?: boolean;
  /** Nasconde completamente la floating label (niente placeholder visibile). */
  hidePlaceholder?: boolean;
  /** Valore iniziale mostrato all'avvio (se non c'è già un `field`/`value`). */
  defaultValue?: number;
  /**
   * Alias di `defaultValue` non in conflitto con l'attributo HTML nativo
   * `defaultValue` (che in alcuni JSX runtime viene intercettato e applicato
   * all'`<input>` invece di propagarsi come prop component).
   */
  initialValue?: number;
  /**
   * Override colore bordo quando `idle=true` e nessun hover diretto
   * (es. card a riposo).
   */
  idleBorder?: string;
  /**
   * Override colore bordo quando `idle=false` (es. hover del card contenitore)
   * ma senza hover diretto sull'input.
   */
  activeBorder?: string;
  /**
   * Se impostata, sostituisce il bordo **solo** quando il puntatore è sul wrapper.
   * Senza di essa, l'hover **non** cambia il bordo (resta uguale allo stato a riposo).
   */
  hoverBorder?: string;
  /** Override colore bordo quando l'input è focused. */
  focusBorder?: string;
  /**
   * Se `true` l'input è in "stato dormiente": bordo invisibile e bottoni
   * `+` / `−` smorzati. Pensato per pattern dove l'input vive dentro una
   * card interattiva e diventa visibile solo all'hover del parent o al focus.
   * Accetta un valore fisso o una funzione/`Signal` reattiva.
   * Il focus utente ha sempre la precedenza e forza lo stato "attivo" pieno.
   */
  idle?: boolean | (() => boolean);
};

export default function InputNumber(props: InputNumberProps) {
  const { size = 3, value: externalValue } = props;

  /**
   * Valore iniziale: preferisco `initialValue` (non in conflitto con l'attributo
   * HTML `defaultValue` che alcuni JSX runtime intercettano prima che arrivi
   * qui come prop). Fallback su `defaultValue` per retrocompatibilità.
   */
  const initialNumber: number | undefined =
    props.initialValue !== undefined ? props.initialValue : props.defaultValue;

  /** Valore tipato numerico (reattivo). Init dal valore iniziale risolto. */
  const value = state<number | undefined>(initialNumber);

  // Utility comuni (errore, bg, optional, metriche, focused). Usa ciò che ti serve.
  const c = useInputCommon<number>({
    size,
    field: props.field,
    error: props.error,
    bg: props.bg,
    mode: props.mode,
    accentColor: props.accentColor,
    focusColor: props.focusColor,
    restingColor: props.restingColor,
    showFocusShadow: props.showFocusShadow,
    readExternal: () =>
      typeof externalValue === "function"
        ? externalValue()
        : externalValue,
    toString: (v) => (v === undefined ? "" : String(v)),
    fromString: (s) => {
      if (s === "") return undefined;
      const n = Number(s);
      return Number.isFinite(n) ? n : undefined;
    },
  });

  // Sync value ↔ field/value esterno
  // (leggi con `c.read()`, scrivi con `c.write()` se vuoi propagare al form)
  void c;

  /**
   * Constraint **derivati**: la prop esplicita (`min`/`max`/`step`/`integer`)
   * ha sempre la precedenza, altrimenti si legge dallo schema del `field`
   * (es. `v.number().min(1).max(100).int()` → `effMin=1`, `effMax=100`,
   * `effInteger=true`). Così non serve più ripetere `min={1}` nel JSX quando
   * è già sullo schema.
   */
  const readMeta = () => {
    const m = c.meta();
    return m && m.kind === "number" ? m : undefined;
  };
  const effMin = (): number | undefined => props.min ?? readMeta()?.min;
  const effMax = (): number | undefined => props.max ?? readMeta()?.max;
  const effStep = (): number => props.step ?? readMeta()?.step ?? 1;
  const effInteger = (): boolean =>
    props.integer ?? readMeta()?.int ?? false;

  /** Stringa mostrata nell'`<input>` (tieni anche stati intermedi come "12."). */
  const displayText = state<string>(
    initialNumber !== undefined ? String(initialNumber) : "",
  );

  /** Stati di press per dare feedback colorato ai bottoni − / +. */
  const pressedMinus = state(false);
  const pressedPlus = state(false);
  /** Stati di hover per un leggero tinting rosso/verde sui bottoni − / +. */
  const hoverMinus = state(false);
  const hoverPlus = state(false);
  /** Hover sul wrapper: alza l'opacità del bordo quando l'utente ci passa sopra. */
  const hoverWrap = state(false);

  /** `true` se placeholder deve "flottare" sopra il bordo. */
  const isFloating = (): boolean => c.focused() || displayText() !== "";

  /** Sanitizza input testuale tenendo solo digit (+ eventuale `.` per decimali). */
  const sanitize = (raw: string): string => {
    const step = effStep();
    const allowDot = !effInteger() && !(Number.isInteger(step) && step >= 1);
    const min = effMin();
    // Permetti leading "-" solo se min è negativo (o non specificato)
    const neg = min === undefined || min < 0;
    let s = raw;
    if (allowDot) {
      s = s.replace(neg ? /[^0-9.-]/g : /[^0-9.]/g, "");
      const firstDot = s.indexOf(".");
      if (firstDot !== -1) {
        s = s.slice(0, firstDot + 1) + s.slice(firstDot + 1).replace(/\./g, "");
      }
    } else {
      s = s.replace(neg ? /[^0-9-]/g : /[^0-9]/g, "");
    }
    if (neg) {
      const hasLead = s.startsWith("-");
      s = s.replace(/-/g, "");
      if (hasLead) s = "-" + s;
    }
    return s;
  };

  /** Ref al nodo `<input>` nel DOM, per scriverci `.value` da `bump()`. */
  let inputEl: HTMLInputElement | null = null;

  /** Handler `input` del nativo: aggiorna la signal `value` (numero) e il field. */
  const onType = (raw: string): void => {
    const s = sanitize(raw);
    if (s !== raw && inputEl) {
      inputEl.value = s;
    }
    displayText(s);
    if (s === "" || s === "-" || s === ".") {
      value(undefined);
      c.write(undefined);
      props.input?.(undefined);
      return;
    }
    const n = Number(s);
    if (Number.isFinite(n)) {
      value(n);
      c.write(n);
      props.input?.(n);
    }
  };

  /** Clampa un numero entro `min`/`max` (espliciti o dedotti dallo schema). */
  const clamp = (n: number): number => {
    let v = n;
    const min = effMin();
    const max = effMax();
    if (min !== undefined && v < min) v = min;
    if (max !== undefined && v > max) v = max;
    return v;
  };

  /** Incrementa/decrementa di `step` (default 1). Partenza: `min ?? 0`. */
  const bump = (dir: 1 | -1): void => {
    const step = effStep();
    const cur = value();
    const base = cur ?? (effMin() ?? 0);
    const next = cur === undefined ? clamp(base) : clamp(base + dir * step);
    if (next === cur) return;
    value(next);
    const nextStr = String(next);
    displayText(nextStr);
    if (inputEl && inputEl.value !== nextStr) inputEl.value = nextStr;
    c.write(next);
    props.input?.(next);
    props.change?.(next);
  };

  /** `true` se si può ancora incrementare/decrementare senza sforare min/max. */
  const canInc = (): boolean => {
    const max = effMax();
    if (max === undefined) return true;
    const cur = value();
    if (cur === undefined) return true;
    return cur + effStep() <= max + 1e-9;
  };
  const canDec = (): boolean => {
    const min = effMin();
    if (min === undefined) return true;
    const cur = value();
    if (cur === undefined) return true;
    return cur - effStep() >= min - 1e-9;
  };

  /**
   * Auto-repeat: tengo premuto − / + → dopo 320ms parte un treno di bump con
   * cadenza accelerata (110ms → 40ms). Cleanup globale su pointerup/cancel
   * così se il pointer lascia l'area o cade fuori, il repeat si ferma.
   */
  let holdTimer: ReturnType<typeof setTimeout> | null = null;
  let repeatTimer: ReturnType<typeof setTimeout> | null = null;
  let activePointer: number | null = null;
  const stealFocusBlock = (ev: Event): void => {
    ev.preventDefault();
    if (inputEl && document.activeElement !== inputEl) {
      inputEl.focus({ preventScroll: true });
    }
  };

  const clearTimers = (): void => {
    if (holdTimer !== null) {
      clearTimeout(holdTimer);
      holdTimer = null;
    }
    if (repeatTimer !== null) {
      clearTimeout(repeatTimer);
      repeatTimer = null;
    }
  };

  const endHold = (): void => {
    if (activePointer === null) return;
    activePointer = null;
    pressedMinus(false);
    pressedPlus(false);
    clearTimers();
    globalThis.removeEventListener("pointerup", onGlobalEnd, true);
    globalThis.removeEventListener("pointercancel", onGlobalEnd, true);
  };

  function onGlobalEnd(ev: Event): void {
    const pe = ev as PointerEvent;
    if (activePointer !== null && pe.pointerId !== activePointer) return;
    endHold();
  }

  const startHold = (dir: 1 | -1): void => {
    holdTimer = setTimeout(() => {
      holdTimer = null;
      let delay = 110;
      const tick = (): void => {
        if (dir > 0 && !canInc()) return endHold();
        if (dir < 0 && !canDec()) return endHold();
        bump(dir);
        delay = Math.max(40, Math.round(delay * 0.88));
        repeatTimer = setTimeout(tick, delay);
      };
      tick();
    }, 320);
  };

  /** Attacca a `pointerdown` del bottone. Fa 1 bump immediato + arma hold. */
  const startStepper = (dir: 1 | -1) => (ev: PointerEvent): void => {
    if (activePointer !== null) return;
    if (dir > 0 && !canInc()) return;
    if (dir < 0 && !canDec()) return;
    ev.preventDefault();
    if (inputEl && document.activeElement !== inputEl) {
      inputEl.focus({ preventScroll: true });
    }
    activePointer = ev.pointerId;
    if (dir > 0) pressedPlus(true);
    else pressedMinus(true);
    try {
      (ev.target as Element).setPointerCapture?.(ev.pointerId);
    } catch {
      /* non supportato */
    }
    bump(dir);
    globalThis.addEventListener("pointerup", onGlobalEnd, true);
    globalThis.addEventListener("pointercancel", onGlobalEnd, true);
    startHold(dir);
  };

  /** Sync display → DOM per cambi non-user (es. `c.read()` da field esterno). */
  watch(() => {
    const t = displayText();
    if (inputEl && inputEl.value !== t) inputEl.value = t;
  });

  /**
   * **External → UI sync**: quando il valore cambia dall'esterno (es. un
   * `space.reset()` sul form che riporta `capacity` a `undefined`, oppure
   * una `setRaw` programmatica) dobbiamo riflettere quel cambio nella UI.
   * Il `c.read()` è reattivo: legge il field se presente, altrimenti il
   * `value`/funzione passati come prop.
   *
   * Skippiamo quando l'utente sta attivamente digitando (`focused()`): in
   * quel caso l'UI è "padrona" e `onType` → `c.write()` propaga già al
   * field; riscrivere ora farebbe saltare il caret e sovrascrivere ciò che
   * l'utente sta scrivendo.
   */
  const hasExternalSource = (): boolean =>
    !!props.field || props.value !== undefined;
  watch(() => {
    const ext = c.read();
    if (c.focused()) return;
    // Nessun field né value esterno → rispettiamo `initialValue`/stato locale,
    // non lasciamo che il `c.read()` "vuoto" cancelli ciò che c'è.
    if (!hasExternalSource()) return;
    if (ext === value()) return;
    value(ext);
    const nextStr = ext === undefined ? "" : String(ext);
    displayText(nextStr);
    if (inputEl && inputEl.value !== nextStr) inputEl.value = nextStr;
  });

  /**
   * Misura la larghezza (in px) di una stringa dato il font. Usa un `canvas`
   * off-screen riusato tra chiamate — è 10-100× più veloce di creare DOM
   * nodi a ogni rerender. La chiave di cache include `font` così se cambia
   * la metrica (device/size) il font del canvas viene riconfigurato.
   */
  const measureCtx: { ctx: CanvasRenderingContext2D | null; key: string } = {
    ctx: null,
    key: "",
  };
  const measureText = (text: string, font: string): number => {
    if (typeof document === "undefined") return text.length * 8;
    if (!measureCtx.ctx) {
      const cv = document.createElement("canvas");
      measureCtx.ctx = cv.getContext("2d");
    }
    if (!measureCtx.ctx) return text.length * 8;
    if (measureCtx.key !== font) {
      measureCtx.ctx.font = font;
      measureCtx.key = font;
    }
    return measureCtx.ctx.measureText(text).width;
  };

  /**
   * Converte una size in `rem`/`em`/`px` in pixel assoluti. Serve perché le
   * metriche (`met.font`, `met.padY`) vengono da `inputMetrics` come stringhe
   * CSS (es. `"0.9rem"`) ma per calcolare la width totale in px ho bisogno
   * del numero. Usa `<html>` come riferimento per `rem`.
   */
  const toPx = (v: string): number => {
    if (typeof document === "undefined") return 14;
    const m = v.trim().match(/^(-?\d*\.?\d+)\s*(px|rem|em)?$/);
    if (!m) return 14;
    const n = parseFloat(m[1]);
    const unit = m[2] ?? "px";
    if (unit === "px") return n;
    const root = parseFloat(
      getComputedStyle(document.documentElement).fontSize || "16",
    );
    return n * (Number.isFinite(root) ? root : 16);
  };

  /**
   * Costruisce la `font` shorthand CSS da usare col canvas: deve matchare
   * esattamente il font dell'input (weight + size + family ereditato).
   */
  const inputFont = (): string => {
    const met = c.m();
    const sizePx = toPx(met.font);
    const family =
      typeof document !== "undefined"
        ? getComputedStyle(document.body).fontFamily ||
          "system-ui, sans-serif"
        : "system-ui, sans-serif";
    return `600 ${sizePx}px ${family}`;
  };
  const labelFont = (): string => {
    const met = c.m();
    const sizePx = toPx(met.labelFloating);
    const family =
      typeof document !== "undefined"
        ? getComputedStyle(document.body).fontFamily ||
          "system-ui, sans-serif"
        : "system-ui, sans-serif";
    return `600 ${sizePx}px ${family}`;
  };

  /**
   * Larghezza **interna** (area dell'input, esclusi steppers e border)
   * calcolata dinamicamente. A riposo: larga quanto il placeholder "inline"
   * (usa il font pieno dell'input, scalato di 1.12 come nello stile a riposo).
   * Col valore digitato: larga quanto il numero corrente.
   * In entrambi i casi, se la label floating (in alto) è più larga del
   * contenuto, allarga fino a contenerla senza troncarla.
   */
  const innerWidthPx = (): number => {
    const t = displayText();
    const ph = props.placeholder ?? "";
    const hidePh = props.hidePlaceholder === true;
    // In modalità `hidePlaceholder` (es. capacity in ResourceCard) l'input
    // vive "come testo": un filo di respiro ai lati così il numero non è
    // incollato al bordo del wrapper. Altrimenti alone più generoso per
    // tenere il placeholder/valore distante dal bordo.
    const paddingX = hidePh ? 10 : 30;
    const labelPadX = 18;
    const fontIn = inputFont();
    const content =
      t !== ""
        ? measureText(t, fontIn)
        : !hidePh && ph !== ""
          ? measureText(ph, fontIn) * 1.12
          : hidePh
            ? toPx(c.m().font) * 0.8
            : toPx(c.m().font) * 2.5;
    const floatingW = !hidePh && ph !== ""
      ? measureText(ph, labelFont()) + labelPadX
      : 0;
    return Math.max(content + paddingX, floatingW);
  };

  /**
   * `<input>` centrale: occupa tutto lo spazio residuo (`flex: 1`), testo
   * centrato, nessun bordo/sfondo/padding nativo — il box visibile è il
   * wrapper. `fontSize` e `padding` derivano dalle metriche di `size`.
   */
  const bareInputStyle = (): Record<string, string> => {
    const met = c.m();
    const err = c.hasError();
    const pal = c.palette();
    return {
      flex: "0 0 auto",
      // Larghezza misurata dal contenuto corrente (valore o placeholder).
      // Animata per l'effetto "premium" di accorciamento quando la label
      // scatta floating e l'utente inizia a digitare.
      width: `${innerWidthPx()}px`,
      height: "100%",
      border: "none",
      background: "transparent",
      outline: "none",
      padding: `${met.padY} 0`,
      margin: "0",
      color: err ? "var(--error)" : pal.text,
      font: "inherit",
      fontSize: met.font,
      fontWeight: "600",
      textAlign: "center",
      WebkitAppearance: "none",
      MozAppearance: "textfield",
      caretColor: err ? "var(--error)" : pal.accent,
      transition:
        "width 240ms cubic-bezier(0.2, 0.8, 0.2, 1), " +
        "color 200ms ease",
    };
  };

  /**
   * Bottoni − / +: altezza piena, larghezza proporzionata al font.
   * Hover → tinta leggera verde/rosso. Press → tinta piena.
   * Il `borderRadius` è arrotondato SOLO sul lato esterno così si inscrive
   * perfettamente dentro il wrapper arrotondato (il lato interno resta dritto
   * per combaciare con l'input).
   */
  const stepperStyle = (
    side: "minus" | "plus",
  ): Record<string, string> => {
    const pressed = side === "minus" ? pressedMinus() : pressedPlus();
    const hovered = side === "minus" ? hoverMinus() : hoverPlus();
    const foc = c.focused();
    const pal = c.palette();
    const rgb = side === "minus" ? pal.stepperMinusRgb : pal.stepperPlusRgb;
    const bg = pressed
      ? `rgba(${rgb}, 1)`
      : hovered
        ? `rgba(${rgb}, 0.18)`
        : "transparent";
    const fg = pressed
      ? "#fff"
      : hovered
        ? `rgba(${rgb}, 1)`
        : pal.stepperResting;
    const fs = c.formStyle();
    const roundRaw = props.round ?? fs?.round;
    const baseRadius =
      roundRaw !== undefined
        ? typeof roundRaw === "number"
          ? `${roundRaw}px`
          : roundRaw
        : `var(--inputRound, var(--round, ${c.m().radius}))`;
    const r = `calc(${baseRadius} - 1px)`;
    const radius = side === "minus" ? `${r} 0 0 ${r}` : `0 ${r} ${r} 0`;
    return {
      alignSelf: "stretch",
      width: foc ? `calc(${c.m().font} * 2.4)` : "0",
      minWidth: foc ? "2.2rem" : "0",
      opacity: foc ? "1" : "0",
      pointerEvents: foc ? "auto" : "none",
      overflow: "hidden",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      userSelect: "none",
      cursor: "pointer",
      fontSize: `calc(${c.m().font} * 1.3)`,
      fontWeight: "800",
      lineHeight: "1",
      color: fg,
      background: bg,
      borderRadius: radius,
      transition:
        "background 160ms ease, color 160ms ease, width 180ms ease, min-width 180ms ease, opacity 160ms ease",
      flex: "0 0 auto",
    };
  };

  /**
   * Floating label **centrata orizzontalmente**: a riposo centrata dentro al
   * box (scale 1.12); in focus o con valore sale "pari pari" sul bordo
   * superiore al centro (scale 1), con `background` = bg del contenitore per
   * tagliare il bordo sotto al testo.
   */
  const labelStyle = (): Record<string, string> => {
    const floating = isFloating();
    const err = c.hasError();
    const foc = c.focused();
    const hv = displayText() !== "";
    const met = c.m();
    const cut = inputCutoutBackground(c.resolvedBg());
    const pal = c.palette();
    const optAtRest =
      c.isOptional() &&
      !foc &&
      !hv &&
      !err &&
      props.restingColor === undefined;
    const color = err
      ? "var(--error)"
      : optAtRest
        ? optionalFieldMutedColor()
        : foc || hv
          ? pal.accent
          : pal.labelResting;
    const scale = floating ? 1 : 1.12;
    return {
      position: "absolute",
      left: "50%",
      top: floating ? "0" : "50%",
      transform: floating
        ? `translate(-50%, -50%) scale(${scale})`
        : `translate(-50%, -50%) scale(${scale})`,
      transformOrigin: "center center",
      paddingLeft: "0.5rem",
      paddingRight: "0.5rem",
      fontSize: met.labelFloating,
      fontWeight: floating ? "600" : "500",
      letterSpacing: floating ? "0.02em" : "0",
      color,
      background: floating ? cut : "transparent",
      pointerEvents: "none",
      whiteSpace: "nowrap",
      lineHeight: "1",
      transition:
        "top 260ms cubic-bezier(0.2, 0.8, 0.2, 1), " +
        "transform 260ms cubic-bezier(0.2, 0.8, 0.2, 1), " +
        "font-weight 200ms ease, " +
        "letter-spacing 200ms ease, " +
        "color 220ms ease, " +
        "background-color 200ms ease",
    };
  };

  /**
   * Stile wrapper: bordo pieno sottile che cambia colore su focus/error/value,
   * come `<InputString>`. Usato inline (non via attributo `s=`) per essere
   * reattivo a focus/hasValue/error.
   */
  /** Valuta la prop `idle` (boolean statico o funzione reattiva). Il focus utente forza "attivo". */
  const isIdle = (): boolean => {
    if (c.focused()) return false;
    const v = typeof props.idle === "function" ? props.idle() : props.idle;
    return v === true;
  };

  const wrapInlineStyle = (): Record<string, string> => {
    const err = c.hasError();
    const foc = c.focused();
    const idle = isIdle();
    const hov = hoverWrap();
    const met = c.m();
    const pal = c.palette();
    const fs = c.formStyle();
    const hasRestingOverride =
      props.restingColor !== undefined || fs?.restingColor !== undefined;
    const idleBorderColor = props.idleBorder ?? "transparent";
    const activeBorderColor =
      props.activeBorder ??
      (c.isOptional() || hasRestingOverride
        ? pal.restingBorder
        : inputRequiredRestingBorderColor());
    const optAtRest =
      c.isOptional() &&
      !foc &&
      displayText() === "" &&
      !err &&
      !hasRestingOverride;
    const borderWhenActive = optAtRest
      ? optionalFieldMutedColor()
      : activeBorderColor;
    /** Bordo a riposo: non alziamo la luminosità in hover a meno che non si passi `hoverBorder` esplicito. */
    const hoverOverride =
      hov && props.hoverBorder !== undefined
        ? mapColorToken(props.hoverBorder) ?? props.hoverBorder
        : null;
    const focusBorderColor = props.focusBorder ?? pal.accent;
    const borderColor = err
      ? "var(--error)"
      : foc
        ? focusBorderColor
        : hoverOverride !== null
          ? hoverOverride
          : idle
            ? idleBorderColor
            : borderWhenActive;
    // `showFocusShadow` in `InputNumber` era storicamente off di default: il
    // preset `auto` lo accende, ma manteniamo la retrocompat pretendendo un
    // opt-in esplicito. Solo quando l'utente (o il form) passa `true`.
    const showShadow =
      props.showFocusShadow === true ||
      (props.showFocusShadow === undefined && fs?.showFocusShadow === true);
    const ring =
      showShadow && foc && !err
        ? `0 0 5px 0 ${pal.accent}`
        : "0 0 0 0 rgba(0,0,0,0)";
    const bwRaw = props.borderWidth ?? fs?.borderWidth ?? 2;
    const bw = typeof bwRaw === "number" ? `${bwRaw}px` : bwRaw;
    const roundRaw = props.round ?? fs?.round;
    const radius =
      roundRaw !== undefined
        ? typeof roundRaw === "number"
          ? `${roundRaw}px`
          : roundRaw
        : `var(--inputRound, var(--round, ${met.radius}))`;
    return {
      position: "relative",
      display: "inline-flex",
      width: "fit-content",
      maxWidth: "100%",
      alignSelf: "flex-start",
      flex: "0 0 auto",
      alignItems: "stretch",
      border: `${bw} solid ${borderColor}`,
      borderRadius: radius,
      background: "transparent",
      boxShadow: ring,
      transition:
        "box-shadow 220ms cubic-bezier(0.2, 0.8, 0.2, 1), " +
        "border-color 180ms ease",
      ...formModeShellScopeVars(props.mode ?? c.formStyle()?.mode),
    };
  };

  /**
   * Mini-etichetta "opzionale" **centrata a cavallo del bordo inferiore**,
   * mostrata automaticamente se lo schema del field è `.optional()`.
   */
  const optionalStyle = (): Record<string, string> => {
    const met = c.m();
    const cut = inputCutoutBackground(c.resolvedBg());
    const pal = c.palette();
    return {
      position: "absolute",
      left: "50%",
      bottom: "0",
      transform: "translate(-50%, 50%)",
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

  let numberWrapEl: HTMLDivElement | null = null;
  const debugN = props.field?.field ?? "no-field";
  watch(() => {
    const fs = c.formStyle();
    const pal = c.palette();
    const foc = c.focused();
    const err = c.hasError();
    const idle = isIdle();
    const hov = hoverWrap();
    const w = wrapInlineStyle();
    const b = bareInputStyle();
    const optAtRest =
      c.isOptional() &&
      !foc &&
      displayText() === "" &&
      !err &&
      props.restingColor === undefined;
    let borderReason = "n/a";
    if (err) borderReason = "error";
    else if (foc) borderReason = "focus→focusBorder/accent";
    else if (props.hoverBorder !== undefined && hov) borderReason = "hoverBorder prop";
    else if (idle === true) borderReason = "idle→idleBorder (spesso transparent)";
    else if (optAtRest) borderReason = "optionalEmpty→optionalFieldMuted (grigio)";
    else if (!c.isOptional()) borderReason = "requiredResting→inputDark";
    else borderReason = "optionalHasValue→restingBorder";

    const palObj = {
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
    };
    const explicitMode = props.mode;
    const inheritedMode = fs?.mode;
    const effectiveMode = explicitMode ?? inheritedMode;
    queueMicrotask(() => {
      let dom: Record<string, string> | null = null;
      if (numberWrapEl && typeof getComputedStyle !== "undefined") {
        const el = getComputedStyle(numberWrapEl);
        dom = {
          borderTopColor: el.borderTopColor,
          borderTopWidth: el.borderTopWidth,
          backgroundColor: el.backgroundColor,
        };
      }
      logInputDebug(`[InputStyleTrace number · ${debugN}]`, {
        variant: "number",
        field: debugN,
        explicitInputMode: explicitMode,
        inheritedFormMode: inheritedMode,
        effectiveMode,
        resolvePaletteInput: {
          mode: props.mode ?? fs?.mode,
          accentColor: props.accentColor ?? fs?.accentColor,
          focusColor: props.focusColor ?? fs?.focusColor,
          restingColor: props.restingColor ?? fs?.restingColor,
          showFocusShadow:
            props.showFocusShadow !== undefined
              ? props.showFocusShadow
              : fs?.showFocusShadow,
        },
        formStyleFromField: fs,
        resolvedBg: c.resolvedBg(),
        surfaceIfExplicitMode:
          effectiveMode !== undefined ? inputSurfaceBg(effectiveMode) : undefined,
        state: { focus: foc, hasError: err, idle, hoverWrap: hov, displayEmpty: displayText() === "" },
        borderReason,
        optAtRestOptionalEmpty: optAtRest,
        fullPalette: palObj,
        wrapStyle: w,
        bareInputStyle: b,
        domComputedOnWrap: dom,
      });
    });
  });

  const domPass = pickInputElementDom(props as Record<string, unknown>);

  return (
    <div
      ref={(el) => {
        numberWrapEl = el as HTMLDivElement | null;
      }}
      style={wrapInlineStyle as any}
      pointerenter={() => hoverWrap(true)}
      pointerleave={() => hoverWrap(false)}
    >
      <div
        style={() => stepperStyle("minus")}
        pointerenter={() => hoverMinus(true)}
        pointerleave={() => {
          hoverMinus(false);
          pressedMinus(false);
        }}
        mousedown={stealFocusBlock}
        pointerdown={startStepper(-1)}
      >
        −
      </div>
      <input
        {...domPass}
        type="text"
        inputmode="decimal"
        disabled={props.disabled}
        autofocus={props.autofocus}
        style={bareInputStyle as any}
        defaultValue={initialNumber !== undefined ? String(initialNumber) : ""}
        ref={(el: HTMLElement | SVGElement | null) => {
          inputEl = el as HTMLInputElement | null;
        }}
        input={onType}
        focusout={props.focusout}
        focus={(e: FocusEvent) => {
          c.focused(true);
          const f = props.focus;
          if (typeof f === "function") void f(e);
        }}
        blur={(_s, _e) => {
          c.focused(false);
          props.blur?.(value());
        }}
      />
      <div
        style={() => stepperStyle("plus")}
        pointerenter={() => hoverPlus(true)}
        pointerleave={() => {
          hoverPlus(false);
          pressedPlus(false);
        }}
        mousedown={stealFocusBlock}
        pointerdown={startStepper(1)}
      >
        +
      </div>
      {props.placeholder && !props.hidePlaceholder ? (
        <div style={labelStyle as any}>{props.placeholder}</div>
      ) : null}
      {c.isOptional() ? (
        <div style={optionalStyle as any}>opzionale</div>
      ) : null}
    </div>
  );
}
