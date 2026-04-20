import {
  For,
  FW_DB_DATA_CHANGED_EVENT,
  FW_DB_SCHEMA_RELOAD_EVENT,
  server,
  state,
  watch,
} from "client";
import { orderColumnsBySchema } from "../../../../core/db/schema/sortColumnKeys";

const cellBreakStyle = {
  wordBreak: "break-word" as const,
  overflowWrap: "break-word" as const,
  verticalAlign: "top" as const,
};

/** Primary accent — green (row counts). Badges live in `fw-db-badge*` in core/client/index.css. */
const primaryGreen = "#4ade80";


type EditCell = {
  key: string;
  tableName: string;
  recordId: string;
  field: string;
  draft: string;
};

type FkEntry = {
  columns?: string[];
  references?: { table?: string };
};

function fkTargetForColumn(foreignKeys: unknown, col: string): string | undefined {
  if (!Array.isArray(foreignKeys)) return undefined;
  for (const f of foreignKeys as FkEntry[]) {
    const c = f.columns?.[0];
    if (c === col) return f.references?.table;
  }
  return undefined;
}

function columnKeysFromRows(rows: readonly Record<string, unknown>[]): string[] {
  const keys = new Set<string>();
  for (const r of rows) for (const k of Object.keys(r)) keys.add(k);
  return [...keys];
}

type FieldTypeDesc =
  | { kind: "string" }
  | { kind: "number" }
  | { kind: "boolean" }
  | { kind: "datetime" }
  | { kind: "date" }
  | { kind: "time" }
  | { kind: "enum"; options: readonly string[] }
  | { kind: "array"; of: FieldTypeDesc }
  | { kind: "object"; shape?: Record<string, FieldTypeDesc> }
  | { kind: "fk"; table: string }
  | { kind: "unknown" };

type ColumnInfo = { key: string; optional: boolean; type: FieldTypeDesc };

const UNKNOWN_TYPE: FieldTypeDesc = { kind: "unknown" };

function buildColumnList(
  columns: unknown,
  fieldKeys: unknown,
  sampleRows: readonly Record<string, unknown>[],
  pk: string,
  foreignKeys: unknown,
): ColumnInfo[] {
  const byKey = new Map<string, ColumnInfo>();
  if (Array.isArray(columns)) {
    for (const c of columns as ColumnInfo[]) {
      if (typeof c?.key !== "string") continue;
      byKey.set(c.key, {
        key: c.key,
        optional: !!c.optional,
        type: (c.type ?? UNKNOWN_TYPE) as FieldTypeDesc,
      });
    }
  }
  const addKey = (k: string): void => {
    if (!byKey.has(k)) byKey.set(k, { key: k, optional: false, type: UNKNOWN_TYPE });
  };
  if (Array.isArray(fieldKeys)) {
    for (const k of fieldKeys as string[]) {
      if (typeof k === "string") addKey(k);
    }
  }
  for (const k of columnKeysFromRows(sampleRows)) addKey(k);
  addKey(pk);
  if (Array.isArray(foreignKeys)) {
    for (const f of foreignKeys as FkEntry[]) {
      const c = f.columns?.[0];
      if (c) addKey(c);
    }
  }
  addKey("createdAt");
  addKey("updatedAt");
  const schemaOrder = Array.isArray(columns)
    ? (columns as ColumnInfo[])
        .map((c) => c.key)
        .filter((k): k is string => typeof k === "string")
    : undefined;
  const ordered = orderColumnsBySchema(schemaOrder, [...byKey.keys()]);
  return ordered.map((k) => byKey.get(k)!);
}

/** Etichetta breve per il badge tipo (es. "string", "array<object>", "enum"). */
function typeLabel(t: FieldTypeDesc): string {
  switch (t.kind) {
    case "array":
      return `array<${typeLabel(t.of)}>`;
    case "enum":
      return "enum";
    case "object":
      return "object";
    case "fk":
      return "fk";
    default:
      return t.kind;
  }
}

/** Colore per ogni tipo — coerente con la palette del DB devtools. */
function typeColors(t: FieldTypeDesc): { fg: string; bg: string; border: string } {
  switch (t.kind) {
    case "string":
      return { fg: "#7dd3fc", bg: "rgba(125, 211, 252, 0.1)", border: "rgba(125, 211, 252, 0.32)" };
    case "number":
      return { fg: "#f0abfc", bg: "rgba(240, 171, 252, 0.1)", border: "rgba(240, 171, 252, 0.32)" };
    case "boolean":
      return { fg: "#fca5a5", bg: "rgba(252, 165, 165, 0.1)", border: "rgba(252, 165, 165, 0.32)" };
    case "datetime":
    case "date":
    case "time":
      return { fg: "#fdba74", bg: "rgba(253, 186, 116, 0.1)", border: "rgba(253, 186, 116, 0.32)" };
    case "enum":
      return { fg: "#86efac", bg: "rgba(134, 239, 172, 0.1)", border: "rgba(134, 239, 172, 0.32)" };
    case "array":
      return { fg: "#5eead4", bg: "rgba(94, 234, 212, 0.1)", border: "rgba(94, 234, 212, 0.32)" };
    case "object":
      return { fg: "#d8b4fe", bg: "rgba(216, 180, 254, 0.1)", border: "rgba(216, 180, 254, 0.32)" };
    case "fk":
      return { fg: "#c4b5fd", bg: "rgba(196, 181, 253, 0.1)", border: "rgba(196, 181, 253, 0.32)" };
    default:
      return { fg: "#a1a1aa", bg: "rgba(161, 161, 170, 0.1)", border: "rgba(161, 161, 170, 0.28)" };
  }
}

/** Full type string for header (monospace). */
function formatTypeFull(t: FieldTypeDesc): string {
  switch (t.kind) {
    case "array":
      return `array<${formatTypeFull(t.of)}>`;
    case "enum":
      return t.options.map((o) => `"${o}"`).join(" | ");
    case "object":
      return "object";
    case "fk":
      return `"${t.table}"`;
    case "unknown":
      return "unknown";
    default:
      return t.kind;
  }
}

/** Color (foreground) for a value at a given kind. */
function valueColor(t: FieldTypeDesc): string {
  return typeColors(t).fg;
}

/** Whether the hover panel has rich content for this type. */
function hasInspect(t: FieldTypeDesc): boolean {
  if (t.kind === "array") return hasInspect(t.of);
  return t.kind === "object" || t.kind === "enum" || t.kind === "fk";
}

// ─── Imperative hover panel (bypasses reactive state so it never re-fetches RPC) ────
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function inspectHtml(t: FieldTypeDesc): string {
  if (t.kind === "array") return inspectHtml(t.of);
  if (t.kind === "object") {
    const entries = Object.entries(t.shape ?? {});
    if (entries.length === 0) {
      return `<span style="color:#71717a;line-height:1.4;font-family:ui-monospace,monospace;font-size:0.78rem">{ }</span>`;
    }
    const rows = entries
      .map(([key, sub]) => {
        const col = valueColor(sub);
        return (
          `<div style="display:flex;gap:8px;align-items:flex-start;line-height:1.45">` +
          `<span style="color:#fafafa;font-weight:600;font-family:ui-monospace,monospace;font-size:0.78rem;flex-shrink:0">${escapeHtml(key)}:</span>` +
          `<span style="color:${col};font-family:ui-monospace,monospace;font-size:0.78rem;word-break:break-word">${escapeHtml(formatTypeFull(sub))}</span>` +
          `</div>`
        );
      })
      .join("");
    return `<div style="display:flex;flex-direction:column;gap:4px">${rows}</div>`;
  }
  if (t.kind === "enum" || t.kind === "fk") {
    return `<span style="color:${valueColor(t)};font-family:ui-monospace,monospace;font-size:0.78rem;line-height:1.45;word-break:break-word">${escapeHtml(formatTypeFull(t))}</span>`;
  }
  return "";
}

let hoverPanelEl: HTMLDivElement | null = null;
let hoverHideTimer: ReturnType<typeof setTimeout> | undefined;

function cancelHoverHide(): void {
  if (hoverHideTimer != null) {
    clearTimeout(hoverHideTimer);
    hoverHideTimer = undefined;
  }
}

function scheduleHoverHide(): void {
  cancelHoverHide();
  hoverHideTimer = setTimeout(() => {
    if (hoverPanelEl) hoverPanelEl.style.display = "none";
  }, 120);
}

function ensureHoverPanel(): HTMLDivElement {
  if (hoverPanelEl && hoverPanelEl.isConnected) return hoverPanelEl;
  const el = document.createElement("div");
  el.className = "fw-db-col-panel";
  el.style.display = "none";
  el.addEventListener("mouseenter", cancelHoverHide);
  el.addEventListener("mouseleave", scheduleHoverHide);
  document.body.appendChild(el);
  hoverPanelEl = el;
  return el;
}

function showHoverPanel(ev: Event, type: FieldTypeDesc): void {
  const target = ev.currentTarget as HTMLElement | null;
  if (!target) return;
  const html = inspectHtml(type);
  if (!html) return;
  const el = ensureHoverPanel();
  el.innerHTML = html;
  cancelHoverHide();
  el.style.display = "flex";
  const r = target.getBoundingClientRect();
  const margin = 8;
  const maxWidth = 28 * 16;
  let x = r.left;
  if (x + maxWidth > window.innerWidth - margin) {
    x = Math.max(margin, window.innerWidth - margin - maxWidth);
  }
  el.style.left = `${String(x)}px`;
  el.style.top = `${String(r.bottom + 6)}px`;
}

function cellText(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function cellDisplayLines(
  v: unknown,
): { kind: "empty" } | { kind: "text"; text: string } | { kind: "json"; text: string } {
  if (v === null || v === undefined) return { kind: "empty" };
  if (typeof v === "object") {
    const text = JSON.stringify(v, null, 2);
    return { kind: "json", text };
  }
  return { kind: "text", text: String(v) };
}

function cellKey(table: string, recordId: string, field: string): string {
  return `${table}:${recordId}:${field}`;
}

function coerceEditValue(draft: string, previous: unknown): unknown {
  if (draft === "" && (previous === null || previous === undefined)) return "";
  if (typeof previous === "number") {
    const n = Number(draft);
    if (Number.isNaN(n)) throw new Error("Invalid number");
    return n;
  }
  if (typeof previous === "boolean") {
    if (draft === "true") return true;
    if (draft === "false") return false;
    throw new Error('Use "true" or "false" for booleans');
  }
  if (typeof previous === "object" && previous !== null) {
    try {
      return JSON.parse(draft) as unknown;
    } catch {
      throw new Error("Invalid JSON for this field");
    }
  }
  return draft;
}

export default function DB() {
  const tables = state(server._devtools.db);
  const [getEdit, setEdit] = watch.source<EditCell | null>(null);

  const refetch = (): void => {
    void tables(server._devtools.db());
  };

  watch(() => {
    let refetchDebounce: ReturnType<typeof setTimeout> | undefined;
    const scheduleRefetch = (): void => {
      if (refetchDebounce != null) clearTimeout(refetchDebounce);
      refetchDebounce = setTimeout(() => {
        refetchDebounce = undefined;
        if (import.meta.env.DEV) {
          console.log("[devtools.db] refetch (schema or on-disk data)");
        }
        refetch();
      }, 250);
    };

    if (import.meta.env.DEV) {
      console.log(
        "[devtools.db] listening:",
        FW_DB_SCHEMA_RELOAD_EVENT,
        "+",
        FW_DB_DATA_CHANGED_EVENT,
        "(HMR)",
      );
    }

    globalThis.addEventListener(FW_DB_SCHEMA_RELOAD_EVENT, scheduleRefetch);

    const onFwDbDataHmr = (): void => {
      scheduleRefetch();
    };
    if (import.meta.env.DEV && import.meta.hot) {
      import.meta.hot.on(FW_DB_DATA_CHANGED_EVENT, onFwDbDataHmr);
    }

    watch.onCleanup(() => {
      if (refetchDebounce != null) clearTimeout(refetchDebounce);
      globalThis.removeEventListener(FW_DB_SCHEMA_RELOAD_EVENT, scheduleRefetch);
      const hot = import.meta.hot;
      if (hot && typeof (hot as { off?: (e: string, fn: () => void) => void }).off === "function") {
        (hot as { off: (e: string, fn: () => void) => void }).off(
          FW_DB_DATA_CHANGED_EVENT,
          onFwDbDataHmr,
        );
      }
    });
  });

  const applyUpdate = async (
    tableName: string,
    recordId: string,
    field: string,
    draft: string,
    previous: unknown,
  ): Promise<void> => {
    let value: unknown;
    try {
      value = coerceEditValue(draft, previous);
    } catch (e) {
      console.error("[devtools.db]", e);
      setEdit(null);
      return;
    }
    if (JSON.stringify(value) === JSON.stringify(previous)) {
      setEdit(null);
      return;
    }
    try {
      await server._devtools.db.rowUpdate({
        table: tableName as never,
        id: recordId,
        field,
        value,
      });
    } catch (e) {
      console.error("[devtools.db] rowUpdate", e);
    }
    setEdit(null);
    refetch();
  };

  return (
    <div s="col gapy-3vh px-6 pb-10 bg-#09090b w-100% minw-0">
      <For each={tables}>
        {(item, index) => {
          const row = item as Record<string, unknown>;
          const name = String(row.name);
          const rowCount = Number(row.rowCount);
          const pkField = String(row.pk ?? "id");
          const foreignKeys = row.foreignKeys;
          const sampleRows =
            (row.sampleRows as Record<string, unknown>[] | undefined) ?? [];
            const columns = buildColumnList(
              row.columns,
              row.fieldKeys,
              sampleRows,
              pkField,
              foreignKeys,
            );
            const keys = columns.map((c) => c.key);
            const optionalByKey = new Map(columns.map((c) => [c.key, c.optional]));
            const typeByKey = new Map(columns.map((c) => [c.key, c.type]));
          const previewNote =
            rowCount > sampleRows.length
              ? ` · sample ${String(sampleRows.length)} / ${String(rowCount)}`
              : "";
          const cardBg = index % 2 === 0 ? "bg-#18181b" : "bg-#141416";

          return (
            <div s={`col round-14px b-#27272a ${cardBg}`}>
              <div s="col gapy-1 px-5 py-4 b-#27272a">
                <t s="text-5 text-#fafafa font-7">{name}</t>
                <t s="text-3 font-6" style={{ color: primaryGreen }}>
                  {rowCount === 1
                    ? `1 row${previewNote}`
                    : `${String(rowCount)} rows${previewNote}`}
                </t>
              </div>

              <div
                className="fw-hscroll"
                style={{
                  overflowX: "auto",
                  overflowY: "visible",
                  maxWidth: "100%",
                  minWidth: 0,
                  display: "block",
                }}
                s="px-2 pb-3 pt-1"
              >
                  <table
                    style={{
                      width: "max-content",
                      minWidth: "100%",
                      borderCollapse: "collapse",
                      tableLayout: "auto",
                    }}
                    s="text-2"
                  >
                    <thead>
                      <tr s="bg-#1c1c1f">
                        <For each={keys}>
                          {(k) => {
                            const isPk = k === pkField;
                            const fkRef = fkTargetForColumn(foreignKeys, k);
                            const isOptional = optionalByKey.get(k) === true && !isPk;
                            const colType = typeByKey.get(k) ?? UNKNOWN_TYPE;
                            const showTypeBadge =
                              !isPk && !fkRef && colType.kind !== "unknown";
                            const tColors = typeColors(colType);
                            return (
                              <th
                                style={{
                                  textAlign: "left",
                                  minWidth: "10rem",
                                  ...cellBreakStyle,
                                }}
                                s="py-3 px-3 b-#3f3f46"
                              >
                                <div
                                  s="row gapx-2 items-center"
                                  style={{ minHeight: 20 }}
                                >
                                  <t
                                    s="text-#e4e4e7 font-7 text-3"
                                    style={{ lineHeight: 1, whiteSpace: "nowrap" }}
                                  >
                                    {k}
                                  </t>
                                  {isPk ? (
                                    <div
                                      className="fw-db-badge fw-db-badge--pk"
                                      title="Primary key"
                                    >
                                      <span className="fw-db-badge__icon">
                                        <icon name="key" size={11} />
                                      </span>
                                    </div>
                                  ) : null}
                                  {fkRef ? (
                                    <div
                                      className="fw-db-badge fw-db-badge--fk"
                                      title={fkRef}
                                    >
                                      <span className="fw-db-badge__icon">
                                        <icon name="link2" size={11} />
                                      </span>
                                      <span className="fw-db-badge__label fw-db-badge__label--truncate">
                                        {fkRef}
                                      </span>
                                    </div>
                                  ) : null}
                                  {showTypeBadge ? (
                                    <div
                                      className="fw-db-badge"
                                      style={{
                                        color: tColors.fg,
                                        background: tColors.bg,
                                        borderColor: tColors.border,
                                      }}
                                      {...(hasInspect(colType)
                                        ? {}
                                        : { title: formatTypeFull(colType) })}
                                      mouseenter={
                                        hasInspect(colType)
                                          ? (e: Event) => showHoverPanel(e, colType)
                                          : undefined
                                      }
                                      mouseleave={
                                        hasInspect(colType)
                                          ? scheduleHoverHide
                                          : undefined
                                      }
                                    >
                                      <span className="fw-db-badge__label">
                                        {typeLabel(colType)}
                                      </span>
                                    </div>
                                  ) : null}
                                  {isOptional ? (
                                    <div
                                      className="fw-db-badge fw-db-badge--opt"
                                      title="Optional"
                                    >
                                      <span className="fw-db-badge__label">?</span>
                                    </div>
                                  ) : null}
                                </div>
                              </th>
                            );
                          }}
                        </For>
                        <th
                          style={{
                            textAlign: "left",
                            minWidth: "6rem",
                            ...cellBreakStyle,
                          }}
                          s="py-3 px-3 text-#a1a1aa font-7 b-#3f3f46"
                        >
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {sampleRows.length === 0 ? (
                        <tr s="bg-#0c0c0e">
                          <For each={keys}>
                            {(_k) => (
                              <td
                                style={cellBreakStyle}
                                s="py-4 px-3 text-#52525b b-#27272a font-mono text-2"
                              >
                                —
                              </td>
                            )}
                          </For>
                          <td style={cellBreakStyle} s="py-4 px-3 b-#27272a text-#52525b text-2">
                            —
                          </td>
                        </tr>
                      ) : (
                        <For each={sampleRows}>
                          {(rec, ri) => {
                            const recObj = rec as Record<string, unknown>;
                            const rid = String(recObj[pkField] ?? "");
                            const line =
                              ri % 2 === 0 ? "bg-#0c0c0e" : "bg-#111113";
                            return (
                              <tr s={line}>
                                <For each={keys}>
                                  {(k) => {
                                    const ck = cellKey(name, rid, k);
                                    const isPk = k === pkField;
                                    const raw = recObj[k as string];
                                    const display = cellText(raw);
                                    const lines = cellDisplayLines(raw);
                                    return (
                                      <td
                                        style={{
                                          minWidth: "10rem",
                                          ...cellBreakStyle,
                                          position: "relative",
                                          cursor: isPk ? "default" : "pointer",
                                        }}
                                        s="py-3 px-3 text-#e4e4e7 b-#27272a"
                                        click={(e) => {
                                          if (isPk) return;
                                          if (getEdit()?.key === ck) return;
                                          const td =
                                            e.currentTarget as HTMLTableCellElement;
                                          setEdit({
                                            key: ck,
                                            tableName: name,
                                            recordId: rid,
                                            field: k,
                                            draft:
                                              display === "—" ? "" : display,
                                          });
                                          globalThis.setTimeout(() => {
                                            td.querySelector("input")?.focus({
                                              preventScroll: true,
                                            });
                                          }, 0);
                                        }}
                                      >
                                        <show
                                          when={() =>
                                            !isPk && getEdit()?.key === ck
                                          }
                                        >
                                          <input
                                            style={{
                                              position: "absolute",
                                              inset: 0,
                                              width: "100%",
                                              height: "100%",
                                              boxSizing: "border-box",
                                              margin: 0,
                                            }}
                                            s="text-2 bg-#18181b text-#e4e4e7 b-#3f3f46 round-6px"
                                            value={
                                              display === "—" ? "" : display
                                            }
                                            mousedown={(e) =>
                                              e.stopPropagation()
                                            }
                                            click={(e) => e.stopPropagation()}
                                            keydown={(e) => {
                                              if (e.key === "Enter") {
                                                (
                                                  e.target as HTMLInputElement
                                                ).blur();
                                              }
                                              if (e.key === "Escape") {
                                                setEdit(null);
                                                e.stopPropagation();
                                              }
                                            }}
                                            blur={(e) => {
                                              if (getEdit()?.key !== ck)
                                                return;
                                              void applyUpdate(
                                                name,
                                                rid,
                                                k,
                                                (e.target as HTMLInputElement)
                                                  .value,
                                                raw,
                                              );
                                            }}
                                          />
                                        </show>
                                        <show
                                          when={() =>
                                            isPk || getEdit()?.key !== ck
                                          }
                                        >
                                          {lines.kind === "empty" ? (
                                            <t s="text-2 text-#52525b">—</t>
                                          ) : lines.kind === "json" ? (
                                            <pre
                                              s="text-2 text-#d4d4d8 m-0 font-mono whitespace-pre-wrap break-all max-h-40 overflow-auto"
                                              style={cellBreakStyle}
                                            >
                                              {lines.text}
                                            </pre>
                                          ) : (
                                            <t s="text-2 text-#e4e4e7">
                                              {lines.text}
                                            </t>
                                          )}
                                        </show>
                                      </td>
                                    );
                                  }}
                                </For>
                                <td
                                  style={cellBreakStyle}
                                  s="py-3 px-3 b-#27272a"
                                >
                                  <t
                                    s="text-2 text-#f87171 font-6"
                                    click={async (e) => {
                                      e.stopPropagation();
                                      try {
                                        await server._devtools.db.rowDelete({
                                          table: name as never,
                                          id: rid,
                                        });
                                      } catch (err) {
                                        console.error(
                                          "[devtools.db] rowDelete",
                                          err,
                                        );
                                        return;
                                      }
                                      setEdit(null);
                                      refetch();
                                    }}
                                  >
                                    Delete
                                  </t>
                                </td>
                              </tr>
                            );
                          }}
                        </For>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
          );
        }}
      </For>
    </div>
  );
}
