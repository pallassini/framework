import {
  For,
  FW_DB_DATA_CHANGED_EVENT,
  FW_DB_SCHEMA_RELOAD_EVENT,
  server,
  state,
  watch,
} from "client";
import { sortDbColumnKeys } from "../../../../core/db/schema/sortColumnKeys";

const cellBreakStyle = {
  wordBreak: "break-word" as const,
  overflowWrap: "break-word" as const,
  verticalAlign: "top" as const,
};

/** Primary accent — green (row counts, PK). */
const primaryGreen = "#4ade80";
const pkGreen = "#4ade80";
const pkGreenBg = "rgba(74, 222, 128, 0.15)";
/** FK badges — violet. */
const fkFg = "#c4b5fd";
const fkBg = "rgba(167, 139, 250, 0.16)";
const fkBorder = "rgba(167, 139, 250, 0.45)";
/** Optional badges — sottili e grigie. */
const optFg = "#a1a1aa";
const optBg = "rgba(161, 161, 170, 0.1)";
const optBorder = "rgba(161, 161, 170, 0.28)";

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

type ColumnInfo = { key: string; optional: boolean };

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
      byKey.set(c.key, { key: c.key, optional: !!c.optional });
    }
  }
  const addKey = (k: string): void => {
    if (!byKey.has(k)) byKey.set(k, { key: k, optional: false });
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
  const ordered = sortDbColumnKeys([...byKey.keys()]);
  return ordered.map((k) => byKey.get(k)!);
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
                  overflowY: "hidden",
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
                            return (
                              <th
                                style={{
                                  textAlign: "left",
                                  minWidth: "10rem",
                                  ...cellBreakStyle,
                                }}
                                s="py-3 px-3 b-#3f3f46"
                              >
                                <div s="row gapx-2 gapy-1 items-center flex-wrap">
                                  <t s="text-#e4e4e7 font-7">{k}</t>
                                  {isPk ? (
                                    <div
                                      style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: "6px",
                                        padding: "2px 8px 2px 6px",
                                        borderRadius: "6px",
                                        color: pkGreen,
                                        backgroundColor: pkGreenBg,
                                        border: `1px solid ${pkGreen}55`,
                                      }}
                                      title="Primary key"
                                    >
                                      <div
                                        style={{
                                          display: "flex",
                                          alignItems: "center",
                                          justifyContent: "center",
                                          flexShrink: 0,
                                          width: 14,
                                          height: 14,
                                          lineHeight: 0,
                                        }}
                                      >
                                        <icon name="key" size={14} />
                                      </div>
                                      <t s="text-2 font-7 leading-none">PK</t>
                                    </div>
                                  ) : null}
                                  {fkRef ? (
                                    <div
                                      style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: "6px",
                                        padding: "2px 8px 2px 6px",
                                        borderRadius: "6px",
                                        color: fkFg,
                                        backgroundColor: fkBg,
                                        border: `1px solid ${fkBorder}`,
                                      }}
                                      title={`FK → ${fkRef}.id`}
                                    >
                                      <div
                                        style={{
                                          display: "flex",
                                          alignItems: "center",
                                          justifyContent: "center",
                                          flexShrink: 0,
                                          width: 14,
                                          height: 14,
                                          lineHeight: 0,
                                        }}
                                      >
                                        <icon name="link2" size={14} />
                                      </div>
                                      <t s="text-2 font-6 leading-none">{fkRef}</t>
                                    </div>
                                  ) : null}
                                  {isOptional ? (
                                    <div
                                      style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        boxSizing: "border-box",
                                        minWidth: 22,
                                        height: 18,
                                        padding: "0 6px",
                                        borderRadius: "9999px",
                                        color: optFg,
                                        backgroundColor: optBg,
                                        border: `1px solid ${optBorder}`,
                                        fontSize: "11px",
                                        fontWeight: 700,
                                        lineHeight: 1,
                                        letterSpacing: 0,
                                        paddingBottom: "2px",
                                      }}
                                      title="Optional field"
                                    >
                                      ?
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
