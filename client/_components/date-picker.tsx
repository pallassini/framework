import { For, mob, state, watch } from "client";
import type { FieldBinding } from "../../core/client/form/form";
import type { InputPropsBase } from "./input/index";
import { useInputCommon } from "./input/common";
import {
  formModeShellScopeVars,
  inputCutoutBackground,
  isNoneInputMode,
  mapColorToken,
  optionalFieldMutedColor,
} from "./input/presets";

export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Data locale `YYYY-MM-DD` (mezzanotte locale). */
export function toIsoLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayIsoLocal(): string {
  return toIsoLocal(new Date());
}

export function isValidIsoDate(s: string): boolean {
  if (!ISO_DATE.test(s)) return false;
  const [y, mo, d] = s.split("-").map(Number);
  const dt = new Date(y, mo - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === d;
}

/** ISO locale `YYYY-MM-DD` ± `deltaDays` (mezzanotte locale). */
export function addDaysIsoLocal(iso: string, deltaDays: number): string | null {
  if (!isValidIsoDate(iso)) return null;
  const [y, mo, d] = iso.split("-").map(Number);
  const dt = new Date(y, mo - 1, d);
  dt.setDate(dt.getDate() + deltaDays);
  return toIsoLocal(dt);
}

function parseIsoLocal(s: string): Date | null {
  if (!isValidIsoDate(s)) return null;
  const [y, mo, d] = s.split("-").map(Number);
  return new Date(y, mo - 1, d);
}

function readBound(v: string | (() => string | undefined) | undefined): string | undefined {
  if (v == null) return undefined;
  const x = typeof v === "function" ? v() : v;
  return x && isValidIsoDate(x) ? x : undefined;
}

function formatIt(iso: string): string {
  const d = parseIsoLocal(iso);
  return d
    ? d.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" })
    : iso;
}

const WEEKDAY_IT = ["Lu", "Ma", "Me", "Gi", "Ve", "Sa", "Do"] as const;

/** Giorni del mese + “spillover” lun/sab/dom del mese precedente/successivo (grigi, non selezionabili). */
function isoFromParts(y: number, month0: number, day: number): string {
  return `${y}-${String(month0 + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function calendarCells(viewYear: number, viewMonth0: number): { iso: string; inMonth: boolean }[] {
  const first = new Date(viewYear, viewMonth0, 1);
  const lastDay = new Date(viewYear, viewMonth0 + 1, 0).getDate();
  const lead = (first.getDay() + 6) % 7;
  const prevLast = new Date(viewYear, viewMonth0, 0).getDate();
  let py = viewYear;
  let pm0 = viewMonth0 - 1;
  if (pm0 < 0) {
    pm0 = 11;
    py--;
  }
  const startPrev = prevLast - lead + 1;
  const out: { iso: string; inMonth: boolean }[] = [];

  if (lead > 0) {
    for (let d = startPrev; d <= prevLast; d++) {
      out.push({ iso: isoFromParts(py, pm0, d), inMonth: false });
    }
  }
  for (let d = 1; d <= lastDay; d++) {
    out.push({ iso: isoFromParts(viewYear, viewMonth0, d), inMonth: true });
  }

  let ny = viewYear;
  let nm0 = viewMonth0 + 1;
  if (nm0 > 11) {
    nm0 = 0;
    ny++;
  }
  let nextD = 1;
  while (out.length % 7 !== 0) {
    out.push({ iso: isoFromParts(ny, nm0, nextD), inMonth: false });
    nextD++;
  }

  return out;
}

/** Distanza sotto il trigger (viewport), allineata al TimePicker. */
const PANEL_GAP_Y = 10;

/**
 * Data `YYYY-MM-DD` (`v.date()`): niente digitazione, solo tap → calendario in portale (stile TimePicker).
 */
export function DatePicker(
  props: InputPropsBase & {
    field?: FieldBinding;
    error?: string | undefined | (() => string | undefined);
    value?: string | (() => string | undefined);
    input?: (value: string) => void;
    change?: (value: string) => void;
    blur?: (value: string) => void;
    /** `YYYY-MM-DD` o getter reattivo (es. `() => todayIsoLocal()`). */
    min?: string | (() => string | undefined);
    max?: string | (() => string | undefined);
  },
) {
  const { size = 3, s: sProp, placeholder, disabled } = props;

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
  const readDate = (): string => c.read() ?? "";
  const open = state(false);

  let shellWrapEl: HTMLElement | null = null;
  const syncShellPseudoFocus = (): void => {
    const el = shellWrapEl;
    if (!(el instanceof HTMLElement)) return;
    if (open()) {
      el.setAttribute("data-fw-shell-pseudo-focus-within", "");
    } else {
      el.removeAttribute("data-fw-shell-pseudo-focus-within");
    }
    el.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
  };

  watch(() => {
    void open();
    syncShellPseudoFocus();
  });

  const n0 = new Date();
  const viewYear = state(n0.getFullYear());
  const viewMonth0 = state(n0.getMonth());

  let triggerEl: HTMLElement | null = null;
  let panelRoot: HTMLDivElement | null = null;
  let backdrop: HTMLDivElement | null = null;
  let panelStop: (() => void) | null = null;

  const minIso = (): string | undefined => readBound(props.min);
  const maxIso = (): string | undefined => readBound(props.max);

  const dayEnabled = (iso: string): boolean => {
    const lo = minIso();
    const hi = maxIso();
    if (lo && iso < lo) return false;
    if (hi && iso > hi) return false;
    return true;
  };

  const isFloating = (): boolean => open() || c.focused() || readDate() !== "";

  /** Larghezza minima in `ch`: a vuoto il trigger non ha testo in flusso → senza questo la label/placeholder esce dal box. */
  const shellMinWidthCh = (): number => {
    const ph = placeholder?.length ?? 0;
    /** Desktop: più respiro; mobile: campo più stretto (il testo viene dal token `text-*` sulla shell). */
    const dateSlot = mob() ? 9 : 12;
    return Math.max(dateSlot, ph + 2);
  };

  const labelStyle = (): Record<string, string> => {
    const floating = isFloating();
    const err = c.hasError();
    const foc = c.focused() || open();
    const hv = readDate() !== "";
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
    const translate = floating ? "translateY(-50%)" : "translateY(0)";
    return {
      position: "absolute",
      left: `calc(${met.padX} - 0.25rem)`,
      right: `calc(${met.padX} - 0.25rem)`,
      top: "0",
      bottom: floating ? "auto" : "0",
      display: "flex",
      alignItems: "center",
      justifyContent: "flex-start",
      minWidth: 0,
      transform: `${translate} scale(${scale})`,
      transformOrigin: "left center",
      paddingLeft: "0.4rem",
      paddingRight: "0.4rem",
      boxSizing: "border-box",
      fontSize: met.labelFloating,
      fontWeight: floating ? "600" : "500",
      letterSpacing: floating ? "0.02em" : "0",
      color,
      background: floating ? cut : "transparent",
      pointerEvents: "none",
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
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

  const wrapInlineStyle = (): Record<string, string> => {
    const minW = `${shellMinWidthCh()}ch`;
    if (noneMode) {
      return {
        position: "relative",
        display: "block",
        /** Blocco stretto sulla data così il testo è centrato e non resta vuoto enorme solo a destra (o bilaterale col `width:100%`). */
        width: "fit-content",
        maxWidth: "100%",
        minWidth: minW,
        marginInline: "auto",
        /** In colonne flex (`mob:`) `align-items: stretch` allunga la largh.; così si resta compatti centrati nella cella. */
        alignSelf: "center",
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
      c.isOptional() && !foc && readDate() === "" && !err && !hasRestingOverride;
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
      display: "inline-block",
      width: "100%",
      maxWidth: "100%",
      minWidth: minW,
      border: `${bw} solid ${borderColor}`,
      borderRadius: radius,
      background: "transparent",
      boxShadow: ring,
      cursor: props.disabled ? "default" : "pointer",
      transition:
        "box-shadow 220ms cubic-bezier(0.2, 0.8, 0.2, 1), border-color 180ms ease",
      ...formModeShellScopeVars(props.mode ?? c.formStyle()?.mode),
    };
  };

  const triggerInnerStyle = (): Record<string, string> => {
    const met = c.m();
    const err = c.hasError();
    const pal = c.palette();
    if (noneMode) {
      return {
        width: "100%",
        boxSizing: "border-box",
        margin: "0",
        padding: "0",
        textAlign: "center",
        userSelect: "none",
      };
    }
    return {
      width: "100%",
      boxSizing: "border-box",
      margin: "0",
      padding: `${met.padY} ${met.padX}`,
      font: "inherit",
      fontSize: met.font,
      fontWeight: "500",
      color: err ? "var(--error)" : pal.text,
      lineHeight: "1.35",
      textAlign: "center",
      userSelect: "none",
    };
  };

  const destroyPanel = (): void => {
    panelStop?.();
    panelStop = null;
    backdrop?.remove();
    panelRoot?.remove();
    backdrop = null;
    panelRoot = null;
  };

  const close = (): void => {
    if (!open()) return;
    open(false);
    c.focused(false);
    destroyPanel();
    props.blur?.(readDate());
  };

  const pick = (iso: string): void => {
    if (!dayEnabled(iso)) return;
    c.write(iso);
    props.input?.(iso);
    props.change?.(iso);
    close();
  };

  /** Il trigger interno può essere smontato quando il `<For>` del calendario re-renderizza; il guscio con `ref` resta stabile per positioning. */
  const anchorForPanel = (): HTMLElement | null => {
    if (shellWrapEl?.isConnected) return shellWrapEl;
    if (triggerEl?.isConnected) return triggerEl;
    return null;
  };

  const shiftMonth = (delta: number): void => {
    let m = viewMonth0() + delta;
    let y = viewYear();
    while (m < 0) {
      m += 12;
      y--;
    }
    while (m > 11) {
      m -= 12;
      y++;
    }
    viewMonth0(m);
    viewYear(y);
  };

  const placePanel = (): void => {
    const anchor = anchorForPanel();
    if (!anchor || !panelRoot) return;
    const r = anchor.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return;
    const top = r.bottom + PANEL_GAP_Y + window.scrollY;
    const left = r.left + r.width / 2 + window.scrollX;
    panelRoot.style.top = `${top}px`;
    panelRoot.style.left = `${left}px`;
  };

  const panelShellStyle = (top: number, left: number): string => {
    const minW = mob() ? "min(89vw,264px)" : "min(92vw,280px)";
    return [
      "position:absolute",
      `top:${top}px`,
      `left:${left}px`,
      "transform:translateX(-50%)",
      "z-index:calc(var(--fw-z-popmenu-portal, 2147483646) + 2)",
      `min-width:${minW}`,
      "box-shadow:0 10px 30px rgba(0,0,0,0.55)",
      "transition:none",
    ].join(";");
  };

  const buildPanel = (): void => {
    const anchor = anchorForPanel();
    if (!anchor) return;
    const r = anchor.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return;
    const top = r.bottom + PANEL_GAP_Y + window.scrollY;
    const left = r.left + r.width / 2 + window.scrollX;

    backdrop = document.createElement("div");
    backdrop.style.cssText =
      "position:fixed;inset:0;z-index:calc(var(--fw-z-popmenu-portal, 2147483646) + 1);";
    backdrop.addEventListener("click", close);
    document.body.appendChild(backdrop);

    panelRoot = document.createElement("div");
    panelRoot.style.cssText = panelShellStyle(top, left);
    document.body.appendChild(panelRoot);

    const shell = (
      <div
        s={{
          base: "col bg-background b-1px b-#2a2a2a round-12px overflow-hidden p-2 gap-2 mob:(origin-top scale-92 p-2 gap-2)",
        }}
      >
        <div
          s="px-1 children-centery"
          style={{
            display: "grid",
            gridTemplateColumns: "auto minmax(0, 1fr) auto",
            gap: "0.35rem",
            alignItems: "center",
          }}
        >
          <div
            s="cursor-pointer row children-centery justify-center p-1 round-8px hover:(bg-#2a2a2a)"
            click={() => shiftMonth(-1)}
          >
            <icon name="chevronLeft" size={5} stroke={2.25} s="shrink-0 opacity-80" />
          </div>
          <t s="text-3 font-6 capitalize text-center min-w-0 truncate">
            {() =>
              new Date(viewYear(), viewMonth0(), 1).toLocaleDateString("it-IT", {
                month: "long",
                year: "numeric",
              })
            }
          </t>
          <div
            s="cursor-pointer row children-centery justify-center p-1 round-8px hover:(bg-#2a2a2a)"
            click={() => shiftMonth(1)}
          >
            <icon name="chevronRight" size={5} stroke={2.25} s="shrink-0 opacity-80" />
          </div>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            gap: "2px",
            textAlign: "center",
          }}
        >
          <For each={WEEKDAY_IT}>
            {(w) => <t s="text-2 opacity-50 font-6 py-1">{w}</t>}
          </For>
          <For
            each={() =>
              calendarCells(viewYear(), viewMonth0()) as readonly {
                iso: string;
                inMonth: boolean;
              }[]
            }
          >
            {(cell) => {
              const iso = cell.iso;
              const inMonth = cell.inMonth;
              const boundsOk = dayEnabled(iso);
              const selectable = inMonth && boundsOk;
              const sel = readDate() === iso;
              const tday = iso === todayIsoLocal();
              return (
                <div
                  click={() => {
                    if (selectable) pick(iso);
                  }}
                  s={{
                    base: {
                      "text-2 font-6 py-2 round-8px mob:(py-1)": true,
                      "text-#8a8a8a pointer-events-none": () => !inMonth,
                      "cursor-pointer hover:(bg-#2a2a2a)": () => selectable,
                      "opacity-28 pointer-events-none": () => inMonth && !boundsOk,
                      "bg-primary text-background": () => sel && selectable,
                      "b-1 b-#ffffff40": () => tday && !sel && selectable,
                    },
                  }}
                >
                  {Number(iso.slice(8))}
                </div>
              );
            }}
          </For>
        </div>
      </div>
    ) as HTMLElement;
    panelRoot.appendChild(shell);

    const cleanups: (() => void)[] = [];
    cleanups.push(
      watch(() => {
        void viewYear();
        void viewMonth0();
        void readDate();
        minIso();
        maxIso();
        placePanel();
      }),
    );
    const onScroll = (): void => placePanel();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    cleanups.push(() => window.removeEventListener("scroll", onScroll, true));
    cleanups.push(() => window.removeEventListener("resize", onScroll));
    panelStop = () => cleanups.forEach((fn) => fn());
  };

  const onOpen = (ev: Event): void => {
    if (props.disabled) return;
    ev.stopPropagation();
    const el = (ev.currentTarget ?? ev.target) as HTMLElement;
    triggerEl = el;
    if (!disabled) {
      try {
        el.focus({ preventScroll: true });
      } catch {
        /* SSR / motori restrittivi */
      }
    }
    if (props.field) {
      triggerEl.setAttribute("data-fw-form", props.field.formId);
      triggerEl.setAttribute("data-fw-field", props.field.field);
    }
    if (open()) {
      close();
      return;
    }
    c.focused(true);
    const cur = parseIsoLocal(readDate());
    if (cur) {
      viewYear(cur.getFullYear());
      viewMonth0(cur.getMonth());
    } else {
      const n = new Date();
      viewYear(n.getFullYear());
      viewMonth0(n.getMonth());
    }
    open(true);
    buildPanel();
  };

  const showText = readDate() !== "" && isValidIsoDate(readDate());

  return (
    <div
      style={wrapInlineStyle as any}
      s={sProp as any}
      ref={(el) => {
        shellWrapEl = (el as HTMLElement) ?? null;
        syncShellPseudoFocus();
      }}
    >
      <div
        click={onOpen}
        tabIndex={disabled ? -1 : 0}
        style={triggerInnerStyle as any}
        ref={(el) => {
          if (el && props.field) {
            (el as HTMLElement).setAttribute("data-fw-form", props.field.formId);
            (el as HTMLElement).setAttribute("data-fw-field", props.field.field);
          }
        }}
      >
        {showText ? <t>{formatIt(readDate())}</t> : null}
      </div>
      {placeholder && !noneMode ? <div style={labelStyle as any}>{placeholder}</div> : null}
    </div>
  );
}
