import { desktop, For, FW_DB_SCHEMA_RELOAD_EVENT, state, watch } from "client";

const tableBaseStyle = {
  width: "100%",
  borderCollapse: "collapse" as const,
  tableLayout: "fixed" as const,
};

const cellBreakStyle = {
  wordBreak: "break-word" as const,
  overflowWrap: "break-word" as const,
  verticalAlign: "top" as const,
};

type EditCell = {
  key: string;
  tableName: string;
  recordId: string;
  field: string;
  draft: string;
};

function fmtIndexes(ix: unknown): string {
  if (!Array.isArray(ix) || ix.length === 0) return "—";
  return ix
    .map((i: { columns?: string[]; unique?: boolean }) => {
      const cols = Array.isArray(i.columns) ? i.columns.join(", ") : "";
      const u = i.unique ? " (U)" : "";
      return `${cols}${u}`;
    })
    .join(" · ");
}

function fmtForeignKeys(fk: unknown): string {
  if (!Array.isArray(fk) || fk.length === 0) return "—";
  return fk
    .map(
      (f: {
        columns?: string[];
        references?: { table?: string };
        onDelete?: string;
      }) => {
        const c = f.columns?.[0] ?? "";
        const ref = f.references?.table ?? "";
        const od = f.onDelete ?? "";
        return `${c} → ${ref} (${od})`;
      },
    )
    .join(" · ");
}

function columnKeys(rows: readonly Record<string, unknown>[]): string[] {
  const keys = new Set<string>();
  for (const r of rows) for (const k of Object.keys(r)) keys.add(k);
  return [...keys].sort((a, b) => {
    if (a === "id") return -1;
    if (b === "id") return 1;
    return a.localeCompare(b);
  });
}

function cellText(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function cellKey(table: string, recordId: string, field: string): string {
  return `${table}:${recordId}:${field}`;
}

function coerceEditValue(draft: string, previous: unknown): unknown {
  if (draft === "" && (previous === null || previous === undefined)) return "";
  if (typeof previous === "number") {
    const n = Number(draft);
    if (Number.isNaN(n)) throw new Error("Numero non valido");
    return n;
  }
  if (typeof previous === "boolean") {
    if (draft === "true") return true;
    if (draft === "false") return false;
    throw new Error('Per boolean usa "true" o "false"');
  }
  if (typeof previous === "object" && previous !== null) {
    try {
      return JSON.parse(draft) as unknown;
    } catch {
      throw new Error("JSON non valido per questo campo");
    }
  }
  return draft;
}

export default function DB() {
  const tables = state(desktop._devtools.db);
  const [getEdit, setEdit] = watch.source<EditCell | null>(null);

  const refetch = (): void => {
    void tables(desktop._devtools.db());
  };

  watch(() => {
    let refetchDebounce: ReturnType<typeof setTimeout> | undefined;
    const onReload = (): void => {
      if (refetchDebounce != null) clearTimeout(refetchDebounce);
      refetchDebounce = setTimeout(() => {
        refetchDebounce = undefined;
        if (import.meta.env.DEV) {
          console.log("[devtools.db] evento schema reload → refetch RPC (debounced)");
        }
        refetch();
      }, 250);
    };
    if (import.meta.env.DEV) {
      console.log("[devtools.db] in ascolto su", FW_DB_SCHEMA_RELOAD_EVENT);
    }
    globalThis.addEventListener(FW_DB_SCHEMA_RELOAD_EVENT, onReload);
    watch.onCleanup(() => {
      if (refetchDebounce != null) clearTimeout(refetchDebounce);
      globalThis.removeEventListener(FW_DB_SCHEMA_RELOAD_EVENT, onReload);
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
      await desktop._devtools.db.rowUpdate({
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
    <div s="col gapy-5 p-5 bg-#09090b minw-100%">
      <div s="col gapy-2">
        <t s="text-7 text-#fafafa font-7 tracking-tight">desktop._devtools.db</t>
        <t s="text-3 text-#71717a">
          Clic su una cella (non PK) per modificare · Elimina su ogni riga · max
          100 righe in anteprima
        </t>
      </div>

      <For each={tables}>
        {(item, index) => {
          const row = item as Record<string, unknown>;
          const name = String(row.name);
          const rowCount = Number(row.rowCount);
          const pkField = String(row.pk ?? "id");
          const pk = row.pk != null ? String(row.pk) : "—";
          const sampleRows =
            (row.sampleRows as Record<string, unknown>[] | undefined) ?? [];
          const keys = columnKeys(sampleRows);
          const previewNote =
            rowCount > sampleRows.length
              ? ` · campione ${String(sampleRows.length)} / ${String(rowCount)}`
              : "";
          const cardBg = index % 2 === 0 ? "bg-#18181b" : "bg-#141416";

          return (
            <div s={`col round-12px b-#27272a ${cardBg}`}>
              <div s="col gapy-2 px-4 py-4 b-#27272a round-12px">
                <div s="row gapx-4 gapy-2 children-centery">
                  <t s="text-5 text-#fafafa font-7 minw-100px">{name}</t>
                  <t s="text-3 text-#a78bfa font-6">
                    {`${String(rowCount)} righe${previewNote}`}
                  </t>
                  <t s="text-2 text-#71717a ml-auto">{`PK · ${pk}`}</t>
                </div>
                <t s="text-2 text-#52525b leading-normal">
                  {`${fmtIndexes(row.indexes)}  ·  ${fmtForeignKeys(row.foreignKeys)}`}
                </t>
              </div>

              {sampleRows.length === 0 ? (
                <div s="px-4 py-6">
                  <t s="text-3 text-#52525b">Nessuna riga</t>
                </div>
              ) : (
                <div s="px-2 pb-2">
                  <table style={tableBaseStyle} s="text-2">
                    <thead>
                      <tr s="bg-#27272a">
                        <For each={keys}>
                          {(k) => (
                            <th
                              style={{
                                textAlign: "left",
                                ...cellBreakStyle,
                              }}
                              s="py-3 px-3 text-#a1a1aa font-7 b-#3f3f46"
                            >
                              {k}
                            </th>
                          )}
                        </For>
                        <th
                          style={{
                            textAlign: "left",
                            ...cellBreakStyle,
                          }}
                          s="py-3 px-3 text-#a1a1aa font-7 b-#3f3f46 minw-96px"
                        >
                          Azioni
                        </th>
                      </tr>
                    </thead>
                    <tbody>
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
                                  return (
                                    <td
                                      style={{
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
                                          draft: display === "—" ? "" : display,
                                        });
                                        // `<show>` riusa i children creati al primo render del `For`: l’autofocus
                                        // in `input()` non riparte al toggle. Focus dopo il flush reattivo.
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
                                          mousedown={(e) => e.stopPropagation()}
                                          click={(e) => e.stopPropagation()}
                                          keydown={(e) => {
                                            if (e.key === "Enter") {
                                              (e.target as HTMLInputElement).blur();
                                            }
                                            if (e.key === "Escape") {
                                              setEdit(null);
                                              e.stopPropagation();
                                            }
                                          }}
                                          blur={(e) => {
                                            if (getEdit()?.key !== ck) return;
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
                                        <t s="text-2 text-#e4e4e7">
                                          {display}
                                        </t>
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
                                      await desktop._devtools.db.rowDelete({
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
                                  Elimina
                                </t>
                              </td>
                            </tr>
                          );
                        }}
                      </For>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        }}
      </For>
    </div>
  );
}
