import { For, state, watch } from "client";

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

  let triggerEl: HTMLElement | null = null;
  let panelRoot: HTMLDivElement | null = null;
  let backdrop: HTMLDivElement | null = null;
  let stopPosWatch: (() => void) | null = null;
  let onWinScrollOrResize: (() => void) | null = null;

  const commit = (): void => {
    void props.onChange(`${hour()}:${minute()}:00`);
  };

  const placePanel = (): void => {
    if (!triggerEl || !panelRoot) return;
    const r = triggerEl.getBoundingClientRect();
    const top = r.bottom + 6;
    const left = r.left + r.width / 2;
    panelRoot.style.top = `${top}px`;
    panelRoot.style.left = `${left}px`;
  };

  /**
   * Sopra il portale Popmenu (`--fw-z-popmenu-portal`), altrimenti il dropdown resta “sotto” il menu.
   * Backdrop +1, pannello +2 rispetto al portal.
   */
  const panelShellStyle = (top: number, left: number): string =>
    [
      "position:fixed",
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
    stopPosWatch?.();
    stopPosWatch = null;
    if (onWinScrollOrResize) {
      window.removeEventListener("scroll", onWinScrollOrResize, true);
      window.removeEventListener("resize", onWinScrollOrResize);
      onWinScrollOrResize = null;
    }
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
    const top = r.bottom + 6;
    const left = r.left + r.width / 2;

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
        s={{ base: "row bg-background b-1px b-#2a2a2a round-10px overflow-hidden" }}
      >
        <PickerColumn values={HOURS} selected={hour} onPick={(v) => hour(v)} />
        <div style={{ width: "1px", alignSelf: "stretch" }} s="bg-#2a2a2a" />
        <PickerColumn
          values={MINUTES}
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
    stopPosWatch = watch(() => {
      void open();
      placePanel();
    });
    onWinScrollOrResize = (): void => placePanel();
    window.addEventListener("scroll", onWinScrollOrResize, true);
    window.addEventListener("resize", onWinScrollOrResize);
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
            ? "bg-transparent text-3 round-6px b-1px px-4px py-2px cursor-pointer row children-centery gapx-1px min-w-0"
            : "bg-transparent text-2 round-8px b-1px px-8px py-4px cursor-pointer row children-centery gapx-1px"]: true,
          "b-#3f3f46": () => !open(),
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

function PickerColumn(props: {
  values: readonly string[];
  selected: ReturnType<typeof state<string>>;
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
                "text-2 px-0.7vw py-0.2vh cursor-pointer centerx font-6": true,
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

function splitHM(v: string): [string, string] {
  const [h = "00", m = "00"] = (v ?? "").split(":");
  return [h.padStart(2, "0"), m.padStart(2, "0")];
}

const SCROLL_HIDE_CLASS = "fw-time-picker-scroll";
const SCROLL_HIDE_STYLE_ID = "fw-time-picker-scroll-style";
if (typeof document !== "undefined" && !document.getElementById(SCROLL_HIDE_STYLE_ID)) {
  const el = document.createElement("style");
  el.id = SCROLL_HIDE_STYLE_ID;
  el.textContent = `.${SCROLL_HIDE_CLASS}::-webkit-scrollbar{display:none;width:0;height:0}`;
  document.head.appendChild(el);
}
