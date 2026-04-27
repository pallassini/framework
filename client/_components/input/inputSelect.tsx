import { resolveFieldBinding, type FieldBinding } from "../../../core/client/form/form";
import { state } from "client";
import { For } from "../../../core/client/runtime/tag";
import Popmenu from "../popmenu";
import { useInputCommon } from "./common";
import type { InputPropsBase, InputSize } from "./index";
import { normalizeInputMode, resolvePalette, type InputMode, type InputPalette } from "./presets";

export type { InputPalette, InputMode };

export type InputSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
  group?: string;
};

export type InputSelectPanelDirection =
  | "center"
  | "top"
  | "bottom"
  | "left"
  | "right"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

/**
 * Props del select: tutto quello che passi dall’`<Input type="select" />` / `Form` arriva in `p.*`.
 *
 * - **`p.mode`**: stringa (`"dark"` | `"light"` | `"none"`) — *non* contiene i colori. È la chiave con cui
 *   i preset scelgono i token; i valori concreti (`stepperMinusRgb`, `text`, `accent`, …) stanno in **`palette`**
 *   sotto, risolti con `resolvePalette` (stessa logica di `inputString` / `useInputCommon`).
 * - **`palette`**: in componente, `const palette = resolvePalette({ mode: p.mode, … })` → allora
 *   `palette.stepperMinusRgb`, `palette.text`, … come in `presets` / `InputPalette`.
 */
export type InputSelectProps = InputPropsBase & {
  field?: FieldBinding;
  error?: string | undefined | (() => string | undefined);
  options?: readonly InputSelectOption[];
  /** Riga con `value: ""` se vuoi un’etichetta esplicita (es. "—") quando il campo è vuoto. */
  emptyLabel?: string;
  value?: string | (() => string);
  /** Valore iniziale se non usi `field` né `value` controllato. */
  defaultValue?: string;
  change?: (value: string) => void;
  disabled?: boolean;
  autofocus?: boolean;
  direction?: InputSelectPanelDirection | string;
};

/**
 * Stessa cosa di `p.*` in JSX: mappa le prop di un select ai parametri di `resolvePalette` per ottenere
 * `InputPalette` (colori / stepper / … da `presets.ts`).
 */
export function inputSelectPalette(
  p: Pick<
    InputSelectProps,
    "mode" | "accentColor" | "focusColor" | "restingColor" | "showFocusShadow"
  >,
): InputPalette {
  return resolvePalette({
    mode: p.mode,
    accentColor: p.accentColor,
    focusColor: p.focusColor,
    restingColor: p.restingColor,
    showFocusShadow: p.showFocusShadow,
  });
}

function readValueProp(p: InputSelectProps): string {
  const { value, defaultValue: dv } = p;
  if (value !== undefined) {
    return typeof value === "function" ? String(value() ?? "") : String(value);
  }
  if (dv !== undefined) {
    return String(dv);
  }
  return "";
}

function initialSelectValue(p: InputSelectProps): string {
  if (p.field) {
    try {
      return String(resolveFieldBinding(p.field).get() ?? "");
    } catch {
      /* */
    }
  }
  return readValueProp(p);
}

export default function InputSelect(p: InputSelectProps) {
  const o = p.options ?? [];
  const localValue = state(initialSelectValue(p));
  const menuPulse = state(0);
  const popMode = normalizeInputMode(p.mode) === "light" ? "light" : "dark";
  const ink = {
    base: { "": true, "text-#000000": popMode === "light", "text-#ffffff": popMode === "dark" },
  };

  const c = useInputCommon<string>({
    size: (p.size ?? 3) as InputSize,
    field: p.field,
    error: p.error,
    bg: p.bg,
    mode: p.mode as InputMode,
    accentColor: p.accentColor,
    focusColor: p.focusColor,
    restingColor: p.restingColor,
    showFocusShadow: p.showFocusShadow,
    readExternal: () => localValue(),
    toString: (v) => (v == null ? "" : String(v)),
    fromString: (s) => s,
  });

  return (
    <>
      <Popmenu
        mode={popMode}
        direction={(p.direction ?? "bottom-right") as InputSelectPanelDirection}
        closePulse={() => menuPulse()}
        collapsed={() => {
          const raw = String(c.read() ?? "");
          const text = raw
            ? o.find((x) => x.value === raw)?.label ?? raw
            : "";
          return (
            <div
              s="p-4 w-full minw-0"
              style={p.disabled ? { opacity: "0.5", pointerEvents: "none" } : undefined}
            >
              <t s={ink}>{text || p.placeholder}</t>
            </div>
          );
        }}
        extended={() => {
          const raw = String(c.read() ?? "");
          const groupTint =
            popMode === "light" ? "text-#0000006e" : "text-#ffffff6e";
          const optRow = (opt: (typeof o)[0], i: number) => {
            const head = Boolean(opt.group && (i === 0 || o[i - 1]?.group !== opt.group));
            const selected = raw === opt.value;
            const baseRow =
              popMode === "light"
                ? "round-6px pl-3 pr-2 py-2.5 minw-0 w-full text-left"
                : "round-6px pl-3 pr-2 py-2.5 minw-0 w-full text-left";
            return (
              <div s="col w-full" key={opt.value + String(i)}>
                {head ? (
                  <t s={`text-2 ${groupTint} font-6 self-start pl-1 pt-1 pb-0.5`}>
                    {opt.group}
                  </t>
                ) : null}
                <div
                  s={() =>
                    baseRow +
                    (opt.disabled
                      ? " op-50 pointer-events-none"
                      : " cursor-pointer transition-colors duration-150") +
                    (popMode === "light"
                      ? (selected
                          ? " bg-#0000000a text-#000000"
                          : " text-#1a1a1a") +
                        (opt.disabled
                          ? ""
                          : " hover:(bg-#0000000d)")
                      : (selected
                          ? " bg-#ffffff10 text-#ffffff"
                          : " text-#f2f2f2") +
                        (opt.disabled
                          ? ""
                          : " hover:(bg-#ffffff14)"))
                  }
                  mousedown={(ev: Event) => {
                    if (!opt.disabled) ev.stopPropagation();
                  }}
                  click={(ev: Event) => {
                    ev.stopPropagation();
                    if (opt.disabled) return;
                    if (p.field) c.write(opt.value);
                    else localValue(opt.value);
                    p.change?.(opt.value);
                    const next = menuPulse() + 1;
                    setTimeout(() => {
                      menuPulse(next);
                    }, 0);
                  }}
                >
                  <t s="text-3 w-full minw-0 ">{opt.label}</t>
                </div>
              </div>
            );
          };
          return (
            <div
              s="col gap-0.5 p-2 maxh-50vh overflow-y-auto minw-12rem"
              mousedown={(ev: Event) => ev.stopPropagation()}
              click={(ev: Event) => ev.stopPropagation()}
            >
              <For each={o}>{(opt, i) => optRow(opt, i)}</For>
            </div>
          );
        }}
      />
    </>
  );
}
