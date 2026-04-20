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
    panelRoot.style.top = `${r.bottom + 6}px`;
    panelRoot.style.left = `${r.left + r.width / 2}px`;
  };

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
    backdrop = document.createElement("div");
    backdrop.style.cssText = "position:fixed;inset:0;z-index:9998;";
    backdrop.addEventListener("click", close);
    document.body.appendChild(backdrop);

    panelRoot = document.createElement("div");
    panelRoot.style.cssText =
      "position:fixed;top:0;left:0;transform:translateX(-50%);z-index:9999;box-shadow:0 10px 30px rgba(0,0,0,0.6);";
    document.body.appendChild(panelRoot);

    const inner = (
      <div s={{ base: "row bg-background b-1px b-#2a2a2a round-10px overflow-hidden" }}>
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

  const toggle = (ev: MouseEvent): void => {
    triggerEl = ev.currentTarget as HTMLElement;
    if (open()) {
      close();
      return;
    }
    open(true);
    buildPanel();
  };

  return (
    <div
      click={toggle}
      style={{
        fontVariantNumeric: "tabular-nums",
        boxSizing: "border-box",
        display: "inline-flex",
      }}
      s={{
        base: {
          "bg-transparent text-1 round-10px b-1px px-10px py-5px cursor-pointer row children-centery gapx-1px": true,
          "b-#2a2a2a": () => !open(),
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
                "text-2 px-0.7vw py-0.2vh cursor-pointer duration-100 centerx font-6": true,
                "bg-primary text-background": () => props.selected() === v,
                "hover:(bg-#2a2a2a)": () => props.selected() !== v,
              },
            }}
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
