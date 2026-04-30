import { For, state, watch } from "client";
import type { FieldBinding } from "../../core/client/form/form";
import type { InputPropsBase, InputSize } from "./input/index";
import { useInputCommon } from "./input/common";
import {
  formModeShellScopeVars,
  inputCutoutBackground,
  isNoneInputMode,
  mapColorToken,
  optionalFieldMutedColor,
} from "./input/presets";

/**
 * Picker orario: dropdown in `document.body`. Con `field` e/o `placeholder` usa il guscio
 * come `<Input>` (label floating centrata sul bordo superiore). Senza → solo trigger compatto (legacy).
 */
export function TimePicker(
  props: InputPropsBase & {
    /** Valore `HH:MM` o `HH:MM:SS`. Omesso / `""` → niente valore finché non si sceglie dall’UI. */
    value?: string | (() => string | undefined);
    onChange?: (value: string) => Promise<unknown> | unknown;
    field?: FieldBinding;
    error?: string | undefined | (() => string | undefined);
    disabled?: boolean;
    min?: string | (() => string | undefined);
    max?: string | (() => string | undefined);
    panelId?: string;
    compact?: boolean;
    size?: InputSize;
  },
) {
  void props.panelId;

  const size = props.size ?? 3;
  const useChrome = !!(props.field || (props.placeholder != null && props.placeholder !== ""));

  const c = useInputCommon<string>({
    size,
    field: props.field,
    error: props.error,
    bg: props.bg,
    mode: props.mode,
    accentColor: props.accentColor,
    focusColor: props.focusColor,
    restingColor: props.restingColor,
    showFocusShadow: props.showFocusShadow,
    readExternal: () => {
      const v = props.value;
      return (typeof v === "function" ? v() : v) ?? "";
    },
    toString: (v) => v ?? "",
    fromString: (s) => s,
  });

  const noneMode = isNoneInputMode(props.mode ?? c.formStyle()?.mode);

  const readTime = (): string => c.read() ?? "";

  const hasTimeValue = (): boolean => {
    const s = readTime().trim();
    return s.length >= 5 && /^([01]\d|2[0-3]):[0-5]\d/.test(s);
  };

  const seedFromRead = (): [string, string] => {
    const s = readTime();
    return splitHM(hasTimeValue() ? s : "00:00:00");
  };

  const [initH, initM] = seedFromRead();
  const hour = state(initH);
  const minute = state(initM);
  const open = state(false);
  /** Sessione picker: non committare se era vuoto e l’utente chiude senza aver toccato ore/minuti. */
  const sessionTouched = state(false);
  let hadValueWhenOpened = false;

  watch(() => {
    const [h, m] = seedFromRead();
    hour(h);
    minute(m);
  });

  const readBound = (v: string | (() => string | undefined) | undefined): string | undefined => {
    if (v == null) return undefined;
    const x = typeof v === "function" ? v() : v;
    return x && x.length >= 5 ? x : undefined;
  };

  const bounds = () => parseRange(readBound(props.min), readBound(props.max));
  const allowedTimes = () => {
    const [minM, maxM] = bounds();
    return ALL_TIMES.filter((t) => {
      const m = toMinutes(t);
      return m >= minM && m <= maxM;
    });
  };
  const allowedHours = () => {
    const hs = new Set(allowedTimes().map((t) => t.slice(0, 2)));
    return HOURS.filter((h) => hs.has(h));
  };
  const allowedMinutes = () => {
    const h = hour();
    return allowedTimes()
      .filter((t) => t.startsWith(`${h}:`))
      .map((t) => t.slice(3, 5));
  };

  let triggerEl: HTMLElement | null = null;
  let panelRoot: HTMLDivElement | null = null;
  let backdrop: HTMLDivElement | null = null;

  const pushValue = (iso: string): void => {
    if (props.field) c.write(iso);
    void props.onChange?.(iso);
  };

  const commit = (): void => {
    const iso = `${hour()}:${minute()}:00`;
    pushValue(iso);
  };

  const placePanel = (): void => {
    if (!triggerEl || !panelRoot) return;
    const r = triggerEl.getBoundingClientRect();
    const top = r.bottom + panelOffsetY() + window.scrollY;
    const left = r.left + r.width / 2 + window.scrollX;
    panelRoot.style.top = `${top}px`;
    panelRoot.style.left = `${left}px`;
  };

  const panelShellStyle = (top: number, left: number): string =>
    [
      "position:absolute",
      `top:${top}px`,
      `left:${left}px`,
      "transform:translateX(-50%)",
      "z-index:calc(var(--fw-z-popmenu-portal, 2147483646) + 2)",
      "box-shadow:0 10px 30px rgba(0,0,0,0.6)",
      "transition:none",
      "opacity:1",
      "will-change:auto",
    ].join(";");

  const destroyPanel = (): void => {
    backdrop?.remove();
    panelRoot?.remove();
    backdrop = null;
    panelRoot = null;
  };

  const close = (): void => {
    if (!open()) return;
    open(false);
    c.focused(false);
    if (sessionTouched() || hadValueWhenOpened) commit();
    destroyPanel();
  };

  const buildPanel = (): void => {
    if (!triggerEl) return;
    const r = triggerEl.getBoundingClientRect();
    const top = r.bottom + panelOffsetY() + window.scrollY;
    const left = r.left + r.width / 2 + window.scrollX;

    backdrop = document.createElement("div");
    backdrop.style.cssText =
      "position:fixed;inset:0;z-index:calc(var(--fw-z-popmenu-portal, 2147483646) + 1);transition:none;";
    backdrop.addEventListener("click", close);
    document.body.appendChild(backdrop);

    panelRoot = document.createElement("div");
    panelRoot.style.cssText = panelShellStyle(top, left);
    document.body.appendChild(panelRoot);

    const inner = (
      <div
        style={{ transition: "none" }}
        s={{ base: "row bg-background b-1px b-#2a2a2a round-10px overflow-hidden mob:(scale-115)" }}
      >
        <PickerColumn
          values={allowedHours}
          selected={hour}
          onPick={(v) => {
            hour(v);
            sessionTouched(true);
          }}
        />
        <div style={{ width: "1px", alignSelf: "stretch" }} s="bg-#2a2a2a" />
        <PickerColumn
          values={allowedMinutes}
          selected={minute}
          onPick={(v) => {
            minute(v);
            sessionTouched(true);
            close();
          }}
        />
      </div>
    ) as HTMLElement;
    panelRoot.appendChild(inner);

    placePanel();
  };

  const onToggle = (ev: Event): void => {
    if (props.disabled) return;
    ev.stopPropagation();
    const el = (ev.currentTarget ?? ev.target) as HTMLElement;
    triggerEl = el;
    if (open()) {
      close();
      return;
    }
    c.focused(true);
    hadValueWhenOpened = hasTimeValue();
    sessionTouched(false);
    const [h, m] = seedFromRead();
    hour(h);
    minute(m);
    open(true);
    buildPanel();
  };

  const isFloating = (): boolean => open() || hasTimeValue() || c.focused();

  const labelStyle = (): Record<string, string> => {
    if (!useChrome || noneMode || !props.placeholder) return { display: "none" };
    const floating = isFloating();
    const err = c.hasError();
    const foc = c.focused() || open();
    const hv = hasTimeValue();
    const met = c.m();
    const cut = inputCutoutBackground(c.resolvedBg());
    const pal = c.palette();
    const optAtRest =
      c.isOptional() && !foc && !hv && !err && props.restingColor === undefined;
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
      transform: `translate(-50%, -50%) scale(${scale})`,
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
        "color 220ms ease, " +
        "background-color 200ms ease",
    };
  };

  const wrapInlineStyle = (): Record<string, string> => {
    if (!useChrome || noneMode) {
      return {
        position: "relative",
        display: "inline-flex",
        maxWidth: "100%",
        alignItems: "stretch",
      };
    }
    const err = c.hasError();
    const foc = c.focused() || open();
    const met = c.m();
    const pal = c.palette();
    const fs = c.formStyle();
    const hasRestingOverride =
      props.restingColor !== undefined || fs?.restingColor !== undefined;
    const optAtRest =
      c.isOptional() && !foc && !hasTimeValue() && !err && !hasRestingOverride;
    const borderColor = err
      ? "var(--error)"
      : foc
        ? mapColorToken(props.focusColor ?? fs?.focusColor) ?? pal.accent
        : optAtRest
          ? optionalFieldMutedColor()
          : pal.restingBorder;
    const showShadow =
      props.showFocusShadow === true ||
      (props.showFocusShadow === undefined && fs?.showFocusShadow === true);
    const ring =
      showShadow && foc && !err ? `0 0 5px 0 ${pal.accent}` : "0 0 0 0 rgba(0,0,0,0)";
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
      width: useChrome ? "100%" : "auto",
      maxWidth: "100%",
      alignItems: "stretch",
      border: `${bw} solid ${borderColor}`,
      borderRadius: radius,
      background: "transparent",
      boxShadow: ring,
      transition:
        "box-shadow 220ms cubic-bezier(0.2, 0.8, 0.2, 1), border-color 180ms ease",
      ...formModeShellScopeVars(props.mode ?? c.formStyle()?.mode),
    };
  };

  const triggerTokenChrome = props.compact
    ? "bg-transparent text-3 round-6px b-2 px-4px py-2px cursor-pointer row children-centery gapx-1px min-w-0 mob:(text-4 px-6px py-3px) des:(text-3 px-5px py-2.5px)"
    : "bg-transparent text-2 round-8px b-2 px-8px py-4px cursor-pointer row children-centery gapx-1px mob:(text-4 px-10px py-5px) des:(text-3 px-9px py-4.5px)";

  /** `mode="none"`: niente bordo/padding/token tipografia sul trigger (tutto dal `s` sul guscio). */
  const triggerTokenBare = props.compact
    ? "bg-transparent round-6px cursor-pointer row children-centery gapx-1px min-w-0 p-0 leading-none"
    : "bg-transparent round-8px cursor-pointer row children-centery gapx-1px p-0 leading-none";

  const triggerInnerStyle = (): Record<string, string> => {
    const met = c.m();
    if (useChrome && !noneMode) {
      return {
        fontVariantNumeric: "tabular-nums",
        boxSizing: "border-box",
        display: "flex",
        flex: "1",
        minWidth: "0",
        alignItems: "center",
        justifyContent: "center",
        touchAction: "manipulation",
        padding: `${met.padY} ${met.padX}`,
      };
    }
    return {
      fontVariantNumeric: "tabular-nums",
      boxSizing: "border-box",
      display: "inline-flex",
      touchAction: "manipulation",
    };
  };

  const showDigits = hasTimeValue() || open();

  return (
    <div style={wrapInlineStyle as any} s={props.s as any}>
      {useChrome && props.placeholder && !noneMode ? (
        <div style={labelStyle as any}>{props.placeholder}</div>
      ) : null}
      <div
        click={onToggle}
        style={triggerInnerStyle as any}
        s={{
          base: {
            [triggerTokenBare]: () => noneMode,
            [triggerTokenChrome]: () => !noneMode,
            "b-transparent": () => useChrome && !noneMode,
            "b-#e3e3e370": () =>
              !noneMode && !open() && (!useChrome || noneMode),
            "b-primary": () => !noneMode && open(),
            "opacity-60 pointer-events-none": () => !!props.disabled,
          },
        }}
      >
        {showDigits ? (
          <>
            <t>{hour}</t>
            <t s="opacity-50">:</t>
            <t>{minute}</t>
          </>
        ) : useChrome && props.placeholder ? (
          <t s="opacity-0 tabular-nums pointer-events-none">00:00</t>
        ) : (
          <>
            <t>{hour}</t>
            <t s="opacity-50">:</t>
            <t>{minute}</t>
          </>
        )}
      </div>
    </div>
  );
}

function panelOffsetY(): number {
  return typeof window === "undefined" ? 6 : window.innerWidth <= 768 ? 16 : 6;
}

function PickerColumn(props: {
  values: () => readonly string[];
  selected: () => string;
  onPick: (v: string) => void;
}) {
  return (
    <div
      className={SCROLL_HIDE_CLASS}
      style={{
        maxHeight: "28vh",
        overflowY: "auto",
        scrollbarWidth: "none",
        msOverflowStyle: "none",
      }}
      s="col"
    >
      <For each={props.values}>
        {(v) => (
          <div
            click={() => props.onPick(v)}
            s={{
              base: {
                "text-2 px-0.7vw py-0.2vh cursor-pointer centerx font-6 mob:(text-3 py-0.35vh px-1.2vw) des:(text-2.5 py-0.25vh px-0.9vw)": true,
                "bg-primary text-background": () => props.selected() === v,
                "hover:(bg-#2a2a2a)": () => props.selected() !== v,
              },
            }}
            style={{ transition: "none" }}
          >
            {v}
          </div>
        )}
      </For>
    </div>
  );
}

const HOURS: readonly string[] = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES: readonly string[] = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));
const ALL_TIMES: readonly string[] = HOURS.flatMap((h) => MINUTES.map((m) => `${h}:${m}`));

function splitHM(v: string): [string, string] {
  const [h = "00", m = "00"] = (v ?? "").split(":");
  return [h.padStart(2, "0"), m.padStart(2, "0")];
}

function toMinutes(v: string): number {
  const [h, m] = splitHM(v);
  return Number(h) * 60 + Number(m);
}

function parseRange(min?: string, max?: string): [number, number] {
  const minM = min ? toMinutes(min) : 0;
  const maxM = max ? toMinutes(max) : 23 * 60 + 55;
  if (minM > maxM) return [maxM, maxM];
  return [minM, maxM];
}

const SCROLL_HIDE_CLASS = "fw-time-picker-scroll";
const SCROLL_HIDE_STYLE_ID = "fw-time-picker-scroll-style";
if (typeof document !== "undefined" && !document.getElementById(SCROLL_HIDE_STYLE_ID)) {
  const el = document.createElement("style");
  el.id = SCROLL_HIDE_STYLE_ID;
  el.textContent = `.${SCROLL_HIDE_CLASS}::-webkit-scrollbar{display:none;width:0;height:0}`;
  document.head.appendChild(el);
}
