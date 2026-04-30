import { For, state } from "client";

/**
 * Picker orario custom:
 * - Trigger con padding comodo e `tabular-nums` (cifre a larghezza uguale → HH:MM non “balla”).
 * - Dropdown **portato in `document.body`** (fuori da ogni stacking/overflow del genitore),
 *   `position: fixed`, coordinate dal `getBoundingClientRect()` del trigger.
 * - Posizione sincronizzata tramite `watch` (si riposiziona anche su scroll/resize).
 */
export function TimePicker(props: {
  value: string;
  onChange: (value: string) => Promise<unknown> | unknown;
  /** Estremo minimo selezionabile (formato HH:MM o HH:MM:SS). */
  min?: string;
  /** Estremo massimo selezionabile (formato HH:MM o HH:MM:SS). */
  max?: string;
  /** Id stabile opzionale (non più necessario ma mantenuto per compat). */
  panelId?: string;
  /** Trigger più compatto (es. riga orari su mobile). */
  compact?: boolean;
}) {
  void props.panelId;

  const [initH, initM] = splitHM(props.value);
  const hour = state(initH);
  const minute = state(initM);
  const open = state(false);
  const bounds = () => parseRange(props.min, props.max);
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

  const commit = (): void => {
    void props.onChange(`${hour()}:${minute()}:00`);
  };

  const placePanel = (): void => {
    if (!triggerEl || !panelRoot) return;
    const r = triggerEl.getBoundingClientRect();
    const top = r.bottom + panelOffsetY() + window.scrollY;
    const left = r.left + r.width / 2 + window.scrollX;
    panelRoot.style.top = `${top}px`;
    panelRoot.style.left = `${left}px`;
  };

  /**
   * Sopra il portale Popmenu (`--fw-z-popmenu-portal`), altrimenti il dropdown resta “sotto” il menu.
   * Backdrop +1, pannello +2 rispetto al portal.
   */
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
    commit();
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
        <PickerColumn values={allowedHours} selected={hour} onPick={(v) => hour(v)} />
        <div style={{ width: "1px", alignSelf: "stretch" }} s="bg-#2a2a2a" />
        <PickerColumn
          values={allowedMinutes}
          selected={minute}
          onPick={(v) => {
            minute(v);
            close();
          }}
        />
      </div>
    ) as HTMLElement;
    panelRoot.appendChild(inner);

    placePanel();
  };

  const onToggle = (ev: Event): void => {
    ev.stopPropagation();
    const el = (ev.currentTarget ?? ev.target) as HTMLElement;
    triggerEl = el;
    if (open()) {
      close();
      return;
    }
    open(true);
    buildPanel();
  };

  return (
    <div
      click={onToggle}
      style={{
        fontVariantNumeric: "tabular-nums",
        boxSizing: "border-box",
        display: "inline-flex",
        touchAction: "manipulation",
      }}
      s={{
        base: {
          [props.compact
            ? "bg-transparent text-3 round-6px b-2 px-4px py-2px cursor-pointer row children-centery gapx-1px min-w-0 mob:(text-4 px-6px py-3px) des:(text-3 px-5px py-2.5px)"
            : "bg-transparent text-2 round-8px b-2 px-8px py-4px cursor-pointer row children-centery gapx-1px mob:(text-4 px-10px py-5px) des:(text-3 px-9px py-4.5px)"]: true,
          "b-#e3e3e370": () => !open(),
          "b-primary": open,
        },
      }}
    >
      <t>{hour}</t>
      <t s="opacity-50">:</t>
      <t>{minute}</t>
    </div>
  );
}

function panelOffsetY(): number {
  if (typeof window === "undefined") return 6;
  return window.innerWidth <= 768 ? 16 : 6;
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
