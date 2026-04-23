import {
  For,
  FW_DB_DATA_CHANGED_EVENT,
  FW_DB_SCHEMA_RELOAD_EVENT,
  server,
  state,
  watch,
} from "client";
import type { FieldTypeDesc } from "../../../../core/client/validator/field-meta";
import { orderColumnsBySchema } from "../../../../core/db/schema/sortColumnKeys";

const cellBreakStyle = {
  wordBreak: "break-word" as const,
  overflowWrap: "break-word" as const,
  verticalAlign: "top" as const,
};

/** Primary accent — green (row counts). Badges live in `fw-db-badge*` in core/client/index.css. */
const primaryGreen = "#4ade80";

/** Larghezze colonne fisse (devtools): niente dipende da contenuto o lunghezza nome. */
const DB_COL_PX = "18rem";
const DB_ACTIONS_PX = "7.5rem";

const dbTableFixedWidth = (dataColCount: number): string =>
  `calc(${String(dataColCount)} * ${DB_COL_PX} + ${DB_ACTIONS_PX})`;

type DbCellStyle = {
  width: string;
  minWidth: string;
  maxWidth: string;
  boxSizing: "border-box";
  textAlign: "left";
  overflow: "hidden";
  verticalAlign: "top";
  borderRight: string;
  position?: "relative";
  cursor?: "default" | "pointer";
};

/** Separatore verticale leggero tra colonne del devtools DB. */
const DB_COL_DIVIDER = "1px solid rgba(255,255,255,0.06)";

const thDataStyle = (): DbCellStyle => ({
  width: DB_COL_PX,
  minWidth: DB_COL_PX,
  maxWidth: DB_COL_PX,
  boxSizing: "border-box",
  textAlign: "left",
  overflow: "hidden",
  verticalAlign: "top",
  borderRight: DB_COL_DIVIDER,
});

const tdDataStyle = (extra?: Partial<DbCellStyle>): DbCellStyle => ({
  ...thDataStyle(),
  ...extra,
});

const thActionsStyle = (): DbCellStyle => ({
  width: DB_ACTIONS_PX,
  minWidth: DB_ACTIONS_PX,
  maxWidth: DB_ACTIONS_PX,
  boxSizing: "border-box",
  textAlign: "left",
  overflow: "hidden",
  verticalAlign: "top",
  borderRight: "none",
});


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

type ColumnInfo = { key: string; optional: boolean; type: FieldTypeDesc };

type SchemaNode = {
  readonly name: string;
  readonly path: readonly string[];
  readonly tables: readonly string[];
  readonly children: readonly SchemaNode[];
};

const UNKNOWN_TYPE: FieldTypeDesc = { kind: "unknown" };

function findSchemaNode(
  tree: readonly SchemaNode[],
  path: readonly string[],
): SchemaNode | null {
  let nodes: readonly SchemaNode[] = tree;
  let found: SchemaNode | null = null;
  for (const seg of path) {
    const next = nodes.find((n) => n.name === seg);
    if (!next) return null;
    found = next;
    nodes = next.children;
  }
  return found;
}

function collectTableNamesDeep(node: SchemaNode): Set<string> {
  const out = new Set<string>();
  const visit = (n: SchemaNode): void => {
    for (const t of n.tables) out.add(t);
    for (const c of n.children) visit(c);
  };
  visit(node);
  return out;
}

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

function toDateInputString(v: unknown): string {
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const d = v instanceof Date ? v : new Date(typeof v === "string" || typeof v === "number" ? v : String(v));
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${String(y)}-${m}-${day}`;
}

function toDatetimeLocalString(v: unknown): string {
  let iso: string;
  if (v instanceof Date) iso = v.toISOString();
  else if (typeof v === "number") iso = new Date(v).toISOString();
  else if (typeof v === "string") {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return "";
    iso = d.toISOString();
  } else return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${String(d.getFullYear())}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toTimeInputString(v: unknown): string {
  if (typeof v !== "string") return "";
  const m = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/.exec(v.trim());
  if (!m) return "";
  return m[3] != null ? `${m[1]}:${m[2]}:${m[3]}` : `${m[1]}:${m[2]}`;
}

/** Stringa per il controllo di editing (input/select/textarea). */
function formatValueForEdit(raw: unknown, t: FieldTypeDesc): string {
  if (raw === null || raw === undefined) return "";
  switch (t.kind) {
    case "boolean":
      return raw === true ? "true" : "false";
    case "number":
      return String(raw);
    case "datetime":
      return toDatetimeLocalString(raw);
    case "date":
      return toDateInputString(raw);
    case "time":
      return toTimeInputString(raw);
    case "enum":
    case "string":
    case "fk":
      return String(raw);
    case "array":
    case "object":
      return typeof raw === "object" ? JSON.stringify(raw, null, 2) : String(raw);
    default:
      return String(raw);
  }
}

function parseDraftToValue(
  draft: string,
  t: FieldTypeDesc,
  optional: boolean,
): unknown {
  const trimmed = draft.trim();
  if (trimmed === "" && optional) return null;
  switch (t.kind) {
    case "number": {
      if (trimmed === "" && !optional) return 0;
      const n = Number(trimmed);
      if (Number.isNaN(n)) throw new Error("Numero non valido");
      return n;
    }
    case "boolean": {
      if (trimmed === "true") return true;
      if (trimmed === "false") return false;
      throw new Error('Scegli "true" o "false"');
    }
    case "datetime": {
      if (trimmed === "" && !optional) throw new Error("Data/ora obbligatoria");
      const d = new Date(trimmed);
      if (Number.isNaN(d.getTime())) throw new Error("Data/ora non valida");
      return d.toISOString();
    }
    case "date": {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) throw new Error("Usa YYYY-MM-DD");
      return trimmed;
    }
    case "time": {
      if (trimmed === "" && optional) return null;
      const m = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/.exec(trimmed);
      if (!m) throw new Error("Usa HH:MM o HH:MM:SS");
      return m[3] != null ? `${m[1]}:${m[2]}:${m[3]}` : `${m[1]}:${m[2]}:00`;
    }
    case "enum": {
      if (!t.options.includes(trimmed)) throw new Error("Valore non tra le opzioni enum");
      return trimmed;
    }
    case "fk":
    case "string":
      return trimmed;
    case "array":
    case "object": {
      try {
        return JSON.parse(draft) as unknown;
      } catch {
        throw new Error("JSON non valido");
      }
    }
    default:
      return trimmed;
  }
}

export default function DB() {
  const tables = state(server._devtools.db);
  const [getEdit, setEdit] = watch.source<EditCell | null>(null);
  const [getTabPath, setTabPath] = watch.source<readonly string[] | null>(null);

  const refetch = (): void => {
    void tables(server._devtools.db());
  };

  type BackendInfo =
    | { mode: "zig"; dataDir?: string }
    | { mode: "remote"; alias: string; baseUrl: string };

  type PayloadShape = {
    tables?: Record<string, Record<string, unknown>>;
    schemaTree?: readonly SchemaNode[];
    tableOrder?: readonly string[];
    backend?: BackendInfo;
  };
  const readPayload = (root: unknown): PayloadShape =>
    (root && typeof root === "object" ? (root as PayloadShape) : {}) as PayloadShape;

  /** Badge 1×1 mostrato in topbar: locale vs remoto. */
  const pickBackendBadge = (root: unknown): readonly BackendInfo[] => {
    const b = readPayload(root).backend;
    return b ? [b] : [];
  };

  /** Per ogni tabella → lo schema *più profondo* che la contiene direttamente. */
  const buildTableToSchemaMap = (
    tree: readonly SchemaNode[],
  ): Map<string, SchemaNode> => {
    const map = new Map<string, SchemaNode>();
    const walk = (n: SchemaNode): void => {
      for (const t of n.tables) map.set(t, n);
      for (const c of n.children) walk(c);
    };
    for (const n of tree) walk(n);
    return map;
  };

  /** Set di tabelle ammesse dal path selezionato (null = tutte). */
  const resolveAllowed = (
    p: PayloadShape,
    path: readonly string[] | null,
  ): Set<string> | null => {
    if (!path) return null;
    const tree = p.schemaTree ?? [];
    const node = findSchemaNode(tree, path);
    return node ? collectTableNamesDeep(node) : null;
  };

  /** Nomi tabelle in ordine di dichiarazione (`db/index.ts`), filtrati per schema. */
  const orderedTableNames = (
    p: PayloadShape,
    allowed: Set<string> | null,
  ): string[] => {
    const tablesMap = p.tables ?? {};
    const order =
      p.tableOrder && p.tableOrder.length > 0
        ? [...p.tableOrder]
        : Object.keys(tablesMap).sort();
    const seen = new Set<string>();
    const out: string[] = [];
    for (const n of order) {
      if (!tablesMap[n]) continue;
      if (allowed && !allowed.has(n)) continue;
      if (seen.has(n)) continue;
      seen.add(n);
      out.push(n);
    }
    for (const n of Object.keys(tablesMap)) {
      if (seen.has(n)) continue;
      if (allowed && !allowed.has(n)) continue;
      seen.add(n);
      out.push(n);
    }
    return out;
  };

  type TableGroup = {
    readonly schemaKey: string;
    readonly schemaName: string;
    readonly schemaPath: readonly string[];
    readonly tables: readonly (Record<string, unknown> & { name: string })[];
  };

  type SchemaTabItem =
    | { readonly kind: "sep"; readonly level: number }
    | {
        readonly kind: "tab";
        readonly label: string;
        readonly path: readonly string[];
        readonly active: boolean;
      };

  const pathEq = (a: readonly string[], b: readonly string[]): boolean =>
    a.length === b.length && a.every((s, i) => s === b[i]);

  /**
   * Tutti gli schemi raggruppati per profondità (senza "All"):
   *  [L1 schemas...] | [L2 schemas...] | [L3 schemas...] | ...
   */
  const buildSchemaTabs = (root: unknown): readonly SchemaTabItem[] => {
    const tree = readPayload(root).schemaTree ?? [];
    const current = getTabPath();
    const byDepth: SchemaNode[][] = [];
    const walk = (nodes: readonly SchemaNode[], depth: number): void => {
      if (!byDepth[depth]) byDepth[depth] = [];
      for (const n of nodes) {
        byDepth[depth]!.push(n);
        walk(n.children, depth + 1);
      }
    };
    walk(tree, 0);

    const out: SchemaTabItem[] = [];
    for (let d = 0; d < byDepth.length; d++) {
      const group = byDepth[d];
      if (!group || group.length === 0) continue;
      if (out.length > 0) out.push({ kind: "sep", level: d + 1 });
      for (const n of group) {
        const active = current != null && pathEq(n.path, current);
        out.push({
          kind: "tab",
          label: n.name,
          path: [...n.path],
          active,
        });
      }
    }
    return out;
  };

  /** Figli dello schema correntemente selezionato — per chips di drill-down. */
  const buildSubSchemaChips = (root: unknown): readonly SchemaNode[] => {
    const current = getTabPath();
    if (!current) return [];
    const tree = readPayload(root).schemaTree ?? [];
    const node = findSchemaNode(tree, current);
    return node?.children ?? [];
  };

  type SchemaLevelGroup = {
    readonly level: number;
    readonly label: string;
    readonly items: readonly (SchemaNode & { readonly active: boolean })[];
  };

  /** Elenco piatto di tutti gli schemi in ordine di profondità — usato per la sidebar collassata. */
  const pickFlatSchemas = (
    root: unknown,
  ): readonly (SchemaNode & { readonly active: boolean })[] => {
    const tree = readPayload(root).schemaTree ?? [];
    const current = getTabPath();
    const out: (SchemaNode & { active: boolean })[] = [];
    const walk = (nodes: readonly SchemaNode[]): void => {
      for (const n of nodes) {
        out.push({
          ...n,
          active: current != null && pathEq(n.path, current),
        });
        walk(n.children);
      }
    };
    walk(tree);
    return out;
  };

  /** Schemi raggruppati per profondità (L1, L2, L3, …) — ciascun livello ha la sua pill e la sua label. */
  const buildSchemaLevels = (root: unknown): readonly SchemaLevelGroup[] => {
    const tree = readPayload(root).schemaTree ?? [];
    const current = getTabPath();
    const byDepth: SchemaNode[][] = [];
    const walk = (nodes: readonly SchemaNode[], depth: number): void => {
      if (!byDepth[depth]) byDepth[depth] = [];
      for (const n of nodes) {
        byDepth[depth]!.push(n);
        walk(n.children, depth + 1);
      }
    };
    walk(tree, 0);
    const out: SchemaLevelGroup[] = [];
    for (let d = 0; d < byDepth.length; d++) {
      const group = byDepth[d];
      if (!group || group.length === 0) continue;
      const level = d + 1;
      out.push({
        level,
        label: level === 1 ? "Root" : `L${String(level)}`,
        items: group.map((n) => ({
          ...n,
          active: current != null && pathEq(n.path, current),
        })),
      });
    }
    return out;
  };

  /** true quando la tab "All" è attiva (nessun path). */
  const isAllActive = (): boolean => getTabPath() == null;

  /** Gruppi di tabelle raggruppate per schema foglia, ordinati come in `db/index.ts`. */
  const pickGroupedTables = (root: unknown): readonly TableGroup[] => {
    const p = readPayload(root);
    const tablesMap = p.tables ?? {};
    const tree = p.schemaTree ?? [];
    const allowed = resolveAllowed(p, getTabPath());
    const names = orderedTableNames(p, allowed);
    const tableToSchema = buildTableToSchemaMap(tree);
    const groupsByKey = new Map<
      string,
      {
        schemaKey: string;
        schemaName: string;
        schemaPath: readonly string[];
        tables: (Record<string, unknown> & { name: string })[];
        order: number;
      }
    >();
    names.forEach((n, idx) => {
      const node = tableToSchema.get(n);
      const key = node ? node.path.join("/") : "__unclassified";
      const label = node ? node.name : "ungrouped";
      const path = node ? [...node.path] : [];
      let g = groupsByKey.get(key);
      if (!g) {
        g = {
          schemaKey: key,
          schemaName: label,
          schemaPath: path,
          tables: [],
          order: idx,
        };
        groupsByKey.set(key, g);
      }
      g.tables.push({ name: n, ...tablesMap[n]! });
    });
    return [...groupsByKey.values()]
      .sort((a, b) => a.order - b.order)
      .map((g) => ({
        schemaKey: g.schemaKey,
        schemaName: g.schemaName,
        schemaPath: g.schemaPath,
        tables: g.tables,
      }));
  };

  /** Chip della top bar: tabelle visibili correnti in ordine di `db/index.ts`. */
  const pickTableChips = (
    root: unknown,
  ): readonly { readonly name: string }[] => {
    const p = readPayload(root);
    const allowed = resolveAllowed(p, getTabPath());
    return orderedTableNames(p, allowed).map((name) => ({ name }));
  };

  /** Scrolla fino al card della tabella (id=`fw-db-table-<name>`). */
  const scrollToTable = (name: string): void => {
    const id = `fw-db-table-${name}`;
    const doScroll = (): void => {
      const el = document.getElementById(id);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    if (document.getElementById(id)) {
      doScroll();
      return;
    }
    globalThis.setTimeout(doScroll, 30);
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
    fieldType: FieldTypeDesc,
    optional: boolean,
  ): Promise<void> => {
    let value: unknown;
    try {
      value = parseDraftToValue(draft, fieldType, optional);
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

  const topBarHeight = "6vh";
  const sidebarCollapsedWidth = "3.5rem";
  const sidebarExpandedWidth = "17rem";
  const iconCircle = {
    width: "2.25rem",
    height: "2.25rem",
    borderRadius: "9999px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
    fontSize: "0.82rem",
    cursor: "pointer",
    userSelect: "none" as const,
    flex: "0 0 auto",
    lineHeight: 1,
  };

  return (
    <>
      {/* ─── FIXED TOP BAR (TABLE SELECTOR) ─────────────────────────────
          Chips centrate, niente label. Same look del Menu, z-100 per coprirlo. */}
      <div
        s="fixed top-0 left-0 w-100% row children-center px-6 bg-background"
        style={{
          height: topBarHeight,
          zIndex: 100,
          overflowX: "auto",
          overflowY: "hidden",
          whiteSpace: "nowrap",
          justifyContent: "center",
          alignItems: "center",
          gap: "0.5rem",
          boxSizing: "border-box",
        }}
      >
        <For each={tables} pick={pickBackendBadge}>
          {(item) => {
            const b = item as unknown as BackendInfo;
            const isRemote = b.mode === "remote";
            const label = isRemote
              ? `REMOTE · ${(b as { alias: string }).alias}`
              : "LOCAL";
            const title = isRemote
              ? `Connesso al DB remoto: ${(b as { baseUrl: string }).baseUrl}`
              : `DB locale (${(b as { dataDir?: string }).dataDir ?? "core/db/data"})`;
            const fg = isRemote ? "#fdba74" : "#4ade80";
            const bg = isRemote
              ? "rgba(253, 186, 116, 0.12)"
              : "rgba(74, 222, 128, 0.12)";
            const border = isRemote
              ? "rgba(253, 186, 116, 0.45)"
              : "rgba(74, 222, 128, 0.45)";
            return (
              <t
                s="text-2 font-7"
                style={{
                  color: fg,
                  background: bg,
                  border: `1px solid ${border}`,
                  borderRadius: "9999px",
                  padding: "0.3rem 0.75rem",
                  userSelect: "none",
                  flex: "0 0 auto",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  whiteSpace: "nowrap",
                }}
                title={title}
              >
                {label}
              </t>
            );
          }}
        </For>

        <For each={tables} pick={pickTableChips}>
          {(item) => {
            const it = item as unknown as { name: string };
            return (
              <t
                s="text-3 font-6 cursor-pointer"
                style={{
                  color: "#e4e4e7",
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: "9999px",
                  padding: "0.35rem 0.9rem",
                  userSelect: "none",
                  flex: "0 0 auto",
                  letterSpacing: "0.01em",
                  transition: "background 140ms ease, border-color 140ms ease",
                }}
                click={() => scrollToTable(it.name)}
              >
                {it.name}
              </t>
            );
          }}
        </For>
      </div>

      {/* ─── FIXED LEFT SIDEBAR (SCHEMAS) ──────────────────────────────
          Compatta (icona) per default, si espande a hover (CSS). */}
      <div
        className="fw-db-sidebar"
        style={{
          position: "fixed",
          left: 0,
          top: topBarHeight,
          height: `calc(100vh - ${topBarHeight})`,
          zIndex: 50,
          background: "var(--background)",
        }}
      >
        {/* ========== COLLAPSED VIEW: only initials ========== */}
        <div
          className="fw-db-sidebar__when-collapsed"
          style={{
            flexDirection: "column",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.75rem 0",
            width: sidebarCollapsedWidth,
            height: "100%",
            overflowY: "auto",
            overflowX: "hidden",
          }}
        >
          <For each={tables} pick={() => [{ active: isAllActive() }]}>
            {(item) => {
              const it = item as unknown as { active: boolean };
              return (
                <div
                  style={{
                    ...iconCircle,
                    color: it.active ? "#09090b" : "#d4d4d8",
                    background: it.active ? primaryGreen : "#1c1c1f",
                    border: `1px solid ${it.active ? primaryGreen : "#27272a"}`,
                  }}
                  title="All"
                  click={() => {
                    setTabPath(null);
                  }}
                >
                  A
                </div>
              );
            }}
          </For>

          <div
            style={{
              width: "1.25rem",
              height: 1,
              background: "#27272a",
              margin: "0.25rem 0",
              flex: "0 0 auto",
            }}
          />

          <For each={tables} pick={pickFlatSchemas}>
            {(item) => {
              const n = item as unknown as SchemaNode & { active: boolean };
              const initial = n.name ? n.name.slice(0, 1).toUpperCase() : "?";
              return (
                <div
                  style={{
                    ...iconCircle,
                    color: n.active ? "#09090b" : "#d4d4d8",
                    background: n.active ? primaryGreen : "#1c1c1f",
                    border: `1px solid ${n.active ? primaryGreen : "#27272a"}`,
                  }}
                  title={n.name}
                  click={() => {
                    setTabPath([...n.path]);
                  }}
                >
                  {initial}
                </div>
              );
            }}
          </For>
        </div>

        {/* ========== EXPANDED VIEW: full names, vertical stacks ========== */}
        <div
          className="fw-db-sidebar__when-expanded"
          style={{
            flexDirection: "column",
            gap: "1rem",
            padding: "1rem",
            width: sidebarExpandedWidth,
            height: "100%",
            overflowY: "auto",
            overflowX: "hidden",
          }}
        >
          <For each={tables} pick={() => [{ active: isAllActive() }]}>
            {(item) => {
              const it = item as unknown as { active: boolean };
              return (
                <div
                  style={{
                    color: it.active ? "#09090b" : "#d4d4d8",
                    background: it.active ? primaryGreen : "#1c1c1f",
                    border: `1px solid ${it.active ? primaryGreen : "#27272a"}`,
                    userSelect: "none",
                    height: "2.4rem",
                    borderRadius: "10px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    fontWeight: 700,
                    fontSize: "0.9rem",
                    lineHeight: 1,
                  }}
                  click={() => {
                    setTabPath(null);
                  }}
                >
                  All
                </div>
              );
            }}
          </For>

          <For each={tables} pick={buildSchemaLevels}>
            {(levelItem) => {
              const lvl = levelItem as unknown as SchemaLevelGroup;
              return (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.5rem",
                    padding: "0.6rem 0.7rem 0.75rem",
                    borderRadius: "10px",
                    background: "#111113",
                    border: "1px solid #27272a",
                  }}
                >
                  <t
                    s="text-2 font-7"
                    style={{
                      color: "#71717a",
                      userSelect: "none",
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                    }}
                  >
                    {lvl.label}
                  </t>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.35rem",
                    }}
                  >
                    <For each={lvl.items}>
                      {(schemaItem) => {
                        const n = schemaItem as SchemaNode & {
                          active: boolean;
                        };
                        return (
                          <t
                            s="text-3 font-6 cursor-pointer"
                            style={{
                              color: n.active ? "#09090b" : "#d4d4d8",
                              background: n.active
                                ? primaryGreen
                                : "#1c1c1f",
                              border: `1px solid ${
                                n.active ? primaryGreen : "#27272a"
                              }`,
                              userSelect: "none",
                              borderRadius: "8px",
                              padding: "0.5rem 0.75rem",
                              display: "block",
                              width: "100%",
                              textAlign: "left",
                            }}
                            click={() => {
                              setTabPath([...n.path]);
                            }}
                          >
                            {n.name}
                          </t>
                        );
                      }}
                    </For>
                  </div>
                </div>
              );
            }}
          </For>

          <For
            each={tables}
            pick={() => (buildSubSchemaChips(tables()).length > 0 ? [true] : [])}
          >
            {() => (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.5rem",
                  padding: "0.6rem 0.7rem 0.75rem",
                  borderRadius: "10px",
                  background: "#111113",
                  border: "1px solid #3f3f46",
                }}
              >
                <t
                  s="text-2 font-7"
                  style={{
                    color: "#a78bfa",
                    userSelect: "none",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                  }}
                >
                  sub-schemas
                </t>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.35rem",
                  }}
                >
                  <For each={tables} pick={buildSubSchemaChips}>
                    {(item) => {
                      const sub = item as unknown as SchemaNode;
                      return (
                        <t
                          s="text-2 font-6 cursor-pointer"
                          style={{
                            color: "#d8b4fe",
                            background: "rgba(216, 180, 254, 0.08)",
                            border: "1px solid rgba(216, 180, 254, 0.3)",
                            userSelect: "none",
                            borderRadius: "8px",
                            padding: "0.4rem 0.7rem",
                            display: "block",
                            width: "100%",
                            textAlign: "left",
                          }}
                          click={() => {
                            setTabPath([...(getTabPath() ?? []), sub.name]);
                          }}
                        >
                          {sub.name}
                        </t>
                      );
                    }}
                  </For>
                </div>
              </div>
            )}
          </For>
        </div>
      </div>

      {/* ─── MAIN ──────────────────────────────────────────────────── */}
      <div
        s="col gapy-3vh pb-10 bg-background minw-0"
        style={{
          paddingLeft: `calc(${sidebarCollapsedWidth} + 1.25rem)`,
          paddingRight: "1.5rem",
          paddingTop: "1.5rem",
        }}
      >
        <For each={tables} pick={pickGroupedTables}>
          {(groupItem) => {
            const g = groupItem as unknown as TableGroup;
            return (
              <div
                s="col gapy-3 round-14px px-4 py-4"
                style={{
                  border: "1px solid rgba(74, 222, 128, 0.30)",
                  background: "rgba(74, 222, 128, 0.04)",
                }}
              >
                <div
                  s="row items-center gapx-2"
                  style={{ userSelect: "none" }}
                >
                  <t
                    s="text-3 font-7"
                    style={{
                      color: primaryGreen,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                    }}
                  >
                    {g.schemaName}
                  </t>
                  <t
                    s="text-2 font-6"
                    style={{ color: "#52525b" }}
                  >
                    {g.schemaPath.length > 1
                      ? `· ${g.schemaPath.join(" / ")}`
                      : ""}
                  </t>
                </div>

                <div s="col gapy-3">
                  <For each={g.tables}>
                    {(tableItem, index) => {
                      const row = tableItem as Record<string, unknown>;
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
            <div
              id={`fw-db-table-${name}`}
              s={`col round-14px b-#27272a ${cardBg}`}
              style={{ scrollMarginTop: "8vh" }}
            >
              <div s="col gapy-2 px-5 py-4 b-#27272a">
                <div
                  s="row gapx-3 children-center"
                  style={{
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    rowGap: "0.5rem",
                  }}
                >
                  <t s="text-5 text-#fafafa font-7">{name}</t>
                  <t
                    s="text-3 font-6 cursor-pointer"
                    style={{
                      color: primaryGreen,
                      background: "rgba(74, 222, 128, 0.12)",
                      border: "1px solid rgba(74, 222, 128, 0.35)",
                      borderRadius: "10px",
                      padding: "0.35rem 0.85rem",
                      userSelect: "none",
                      flex: "0 0 auto",
                    }}
                    click={async (e) => {
                      e.stopPropagation();
                      try {
                        await server._devtools.db.rowCreate({
                          table: name as never,
                        });
                      } catch (err) {
                        console.error("[devtools.db] rowCreate", err);
                        return;
                      }
                      setEdit(null);
                      refetch();
                    }}
                  >
                    + Nuova riga
                  </t>
                </div>
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
                    className="fw-db-table"
                    style={{
                      tableLayout: "fixed",
                      width: dbTableFixedWidth(keys.length),
                      minWidth: dbTableFixedWidth(keys.length),
                      borderCollapse: "collapse",
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
                                style={thDataStyle()}
                                s="py-3 px-3 b-#3f3f46"
                              >
                                <div
                                  s="row gapx-2 children-center"
                                  style={{
                                    minHeight: 20,
                                    minWidth: 0,
                                    width: "100%",
                                    maxWidth: "100%",
                                    overflow: "hidden",
                                    flexWrap: "nowrap",
                                  }}
                                >
                                  <t
                                    s="text-#e4e4e7 font-7 text-3"
                                    style={{
                                      lineHeight: 1,
                                      whiteSpace: "nowrap",
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                      minWidth: 0,
                                      flex: "1 1 0%",
                                      maxWidth: "100%",
                                    }}
                                    title={k}
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
                          style={thActionsStyle()}
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
                                style={tdDataStyle()}
                                s="py-4 px-3 text-#52525b b-#27272a font-mono text-2"
                              >
                                —
                              </td>
                            )}
                          </For>
                          <td
                            style={thActionsStyle()}
                            s="py-4 px-3 b-#27272a text-#52525b text-2"
                          >
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
                                    const colType =
                                      typeByKey.get(k) ?? UNKNOWN_TYPE;
                                    const isOptionalCol =
                                      optionalByKey.get(k) === true && !isPk;
                                    const editBase: Record<string, unknown> = {
                                      position: "absolute",
                                      inset: 0,
                                      width: "100%",
                                      height: "100%",
                                      boxSizing: "border-box",
                                      margin: 0,
                                    };
                                    return (
                                      <td
                                        style={tdDataStyle({
                                          position: "relative",
                                          cursor: isPk ? "default" : "pointer",
                                        })}
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
                                            draft: formatValueForEdit(
                                              raw,
                                              colType,
                                            ),
                                          });
                                          globalThis.setTimeout(() => {
                                            const z = td.querySelector(
                                              "input, select, textarea",
                                            );
                                            if (z instanceof HTMLElement)
                                              z.focus({ preventScroll: true });
                                          }, 0);
                                        }}
                                      >
                                        <show
                                          when={() =>
                                            !isPk && getEdit()?.key === ck
                                          }
                                        >
                                          {colType.kind === "boolean" ? (
                                            <select
                                              style={editBase as never}
                                              s="text-2 bg-#18181b text-#e4e4e7 b-#3f3f46 round-6px"
                                              value={
                                                getEdit()?.key === ck
                                                  ? getEdit()!.draft
                                                  : formatValueForEdit(
                                                      raw,
                                                      colType,
                                                    )
                                              }
                                              mousedown={(e: Event) =>
                                                e.stopPropagation()
                                              }
                                              change={(e: Event) => {
                                                void applyUpdate(
                                                  name,
                                                  rid,
                                                  k,
                                                  (e.target as HTMLSelectElement)
                                                    .value,
                                                  raw,
                                                  colType,
                                                  isOptionalCol,
                                                );
                                              }}
                                            >
                                              <option value="true">true</option>
                                              <option value="false">false</option>
                                            </select>
                                          ) : colType.kind === "enum" ? (
                                            <select
                                              style={editBase as never}
                                              s="text-2 bg-#18181b text-#e4e4e7 b-#3f3f46 round-6px"
                                              value={
                                                getEdit()?.key === ck
                                                  ? getEdit()!.draft
                                                  : formatValueForEdit(
                                                      raw,
                                                      colType,
                                                    )
                                              }
                                              mousedown={(e: Event) =>
                                                e.stopPropagation()
                                              }
                                              change={(e: Event) => {
                                                void applyUpdate(
                                                  name,
                                                  rid,
                                                  k,
                                                  (e.target as HTMLSelectElement)
                                                    .value,
                                                  raw,
                                                  colType,
                                                  isOptionalCol,
                                                );
                                              }}
                                            >
                                              {colType.options.map((opt) => (
                                                <option value={opt}>
                                                  {opt}
                                                </option>
                                              ))}
                                            </select>
                                          ) : colType.kind === "array" ||
                                            colType.kind === "object" ? (
                                            <textarea
                                              style={{
                                                ...editBase,
                                                minHeight: "5rem",
                                                resize: "vertical",
                                                fontFamily:
                                                  "ui-monospace, monospace",
                                              }}
                                              s="text-2 bg-#18181b text-#e4e4e7 b-#3f3f46 round-6px px-2 py-1"
                                              defaultValue={formatValueForEdit(
                                                raw,
                                                colType,
                                              )}
                                              mousedown={(e: Event) =>
                                                e.stopPropagation()
                                              }
                                              click={(e: Event) => e.stopPropagation()}
                                              keydown={(e: KeyboardEvent) => {
                                                if (e.key === "Escape") {
                                                  setEdit(null);
                                                  e.stopPropagation();
                                                }
                                              }}
                                              blur={(e: Event) => {
                                                if (getEdit()?.key !== ck)
                                                  return;
                                                void applyUpdate(
                                                  name,
                                                  rid,
                                                  k,
                                                  (
                                                    e.target as HTMLTextAreaElement
                                                  ).value,
                                                  raw,
                                                  colType,
                                                  isOptionalCol,
                                                );
                                              }}
                                            />
                                          ) : (
                                            <input
                                              style={editBase}
                                              s="text-2 bg-#18181b text-#e4e4e7 b-#3f3f46 round-6px"
                                              type={
                                                colType.kind === "number"
                                                  ? "number"
                                                  : colType.kind === "date"
                                                    ? "date"
                                                    : colType.kind === "datetime"
                                                      ? "datetime-local"
                                                      : colType.kind === "time"
                                                        ? "time"
                                                        : "text"
                                              }
                                              step={
                                                colType.kind === "number"
                                                  ? "any"
                                                  : colType.kind === "time"
                                                    ? "1"
                                                    : undefined
                                              }
                                              defaultValue={formatValueForEdit(
                                                raw,
                                                colType,
                                              )}
                                              mousedown={(e: Event) =>
                                                e.stopPropagation()
                                              }
                                              click={(e: Event) => e.stopPropagation()}
                                              keydown={(e: KeyboardEvent) => {
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
                                              blur={(value: string) => {
                                                if (getEdit()?.key !== ck)
                                                  return;
                                                void applyUpdate(
                                                  name,
                                                  rid,
                                                  k,
                                                  value,
                                                  raw,
                                                  colType,
                                                  isOptionalCol,
                                                );
                                              }}
                                            />
                                          )}
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
                                              s="text-2 text-#d4d4d8 m-0 font-mono"
                                              style={{
                                                whiteSpace: "pre",
                                                maxHeight: "9rem",
                                                overflow: "auto",
                                                width: "100%",
                                                minWidth: 0,
                                              }}
                                              title="Click to expand"
                                            >
                                              {lines.text}
                                            </pre>
                                          ) : (
                                            <t
                                              s="text-2 text-#e4e4e7"
                                              style={{
                                                display: "block",
                                                whiteSpace: "nowrap",
                                                overflow: "hidden",
                                                textOverflow: "ellipsis",
                                                width: "100%",
                                                maxWidth: "100%",
                                              }}
                                              title={lines.text}
                                            >
                                              {lines.text}
                                            </t>
                                          )}
                                        </show>
                                      </td>
                                    );
                                  }}
                                </For>
                                <td
                                  style={thActionsStyle()}
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
              </div>
            );
          }}
        </For>
      </div>
    </>
  );
}
