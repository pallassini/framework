import type { CatalogJson } from "../schema/defineSchema";
import type { DbRow } from "./types";

/**
 * Nodo dell'albero `select`. Costruito a partire dall'array di path dot-separati.
 *
 * - `leaf` = true quando il path termina qui (campo scalare o oggetto "as-is").
 * - `children` = continuazioni per path più profondi (fusione automatica dei prefissi).
 */
export type SelectNode = {
	leaf: boolean;
	children: Map<string, SelectNode>;
};

function newNode(): SelectNode {
	return { leaf: false, children: new Map() };
}

/** Parse di `["id", "customerId.name", "customerId.email", "items.itemId.name"]` → albero. */
export function parseSelect(paths: readonly string[]): SelectNode {
	const root = newNode();
	for (const raw of paths) {
		const path = raw.trim();
		if (!path) continue;
		const segs = path.split(".").filter(Boolean);
		if (segs.length === 0) continue;
		let cur = root;
		for (let i = 0; i < segs.length; i++) {
			const s = segs[i]!;
			let child = cur.children.get(s);
			if (!child) {
				child = newNode();
				cur.children.set(s, child);
			}
			if (i === segs.length - 1) child.leaf = true;
			cur = child;
		}
	}
	return root;
}

/** `{ tableName: { colName: refTable } }` — estratto dal `catalog.json`. */
export type FkMap = Readonly<Record<string, Readonly<Record<string, string>>>>;

export function fkMapFromCatalog(catalog: CatalogJson): FkMap {
	const out: Record<string, Record<string, string>> = {};
	for (const [tn, spec] of Object.entries(catalog.tables)) {
		const cols: Record<string, string> = {};
		for (const fk of spec.foreignKeys) {
			const col = fk.columns[0];
			const ref = fk.references.table;
			if (col && ref) cols[col] = ref;
		}
		if (Object.keys(cols).length) out[tn] = cols;
	}
	return out;
}

/** Fetcher: ritorna le righe di `table` con gli `ids` richiesti (ordine irrilevante). */
export type BatchFetcher = (table: string, ids: readonly string[]) => Promise<Map<string, DbRow>>;

/**
 * Fase di pianificazione: visita `node` su `table` raccogliendo gli id richiesti
 * per le FK. Prima di proiettare, le FK vengono risolte in batch (1 fetch per tabella/livello).
 *
 * Strategy a due passi:
 * 1. `collectFkIds` — attraversa righe + albero + catalog, accumula `Map<refTable, Set<id>>`.
 * 2. `project` — riusa i risultati caricati per produrre l'output finale.
 */
async function collectFkIds(
	rows: readonly DbRow[],
	node: SelectNode,
	table: string,
	fkMap: FkMap,
	wanted: Map<string, Set<string>>,
): Promise<void> {
	if (node.children.size === 0) return;
	for (const [col, child] of node.children) {
		const refTable = fkMap[table]?.[col];
		if (refTable) {
			const bucket = wanted.get(refTable) ?? new Set<string>();
			for (const row of rows) {
				const raw = row?.[col];
				if (raw == null) continue;
				if (Array.isArray(raw)) {
					for (const v of raw) if (typeof v === "string" && v) bucket.add(v);
				} else if (typeof raw === "string") {
					bucket.add(raw);
				}
			}
			if (bucket.size) wanted.set(refTable, bucket);
			continue;
		}
		// Campo plain (object / array di oggetti). Visita sotto-oggetti.
		const nested: DbRow[] = [];
		for (const row of rows) {
			const raw = row?.[col];
			if (raw == null) continue;
			if (Array.isArray(raw)) {
				for (const v of raw) if (v && typeof v === "object") nested.push(v as DbRow);
			} else if (typeof raw === "object") {
				nested.push(raw as DbRow);
			}
		}
		if (nested.length === 0) continue;
		// Dentro un plain object/array niente FK resolvibile dal catalog (la tabella
		// è la stessa solo se il campo è self-ref; per ora trattiamo come “no fk”).
		// Se dentro al plain ci sono colonne FK (es. `items.itemId`), il catalog **non**
		// le espone perché appartengono allo shape interno. Serve un mapping extra.
		// Fallback: rileviamo le FK se il nome di colonna corrisponde a una tabella
		// nella mappa globale: `itemId` → `items`? No, troppo fragile.
		// Soluzione: usiamo una convenzione — se il valore è string E il child ha figli,
		// proviamo a risolverlo come FK cercando una tabella `<col senza Id>` o `<col senza Ids>`.
		await collectFkIdsNested(nested, child, fkMap, wanted);
	}
}

/**
 * Versione "nested" per oggetti dentro array (es. `bookings.items[].itemId`).
 * Qui non abbiamo una tabella di riferimento, ma usiamo la convenzione
 * `"<field>Id"` → tabella `"<field>s"` (es. `itemId` → `items`).
 */
async function collectFkIdsNested(
	rows: readonly DbRow[],
	node: SelectNode,
	fkMap: FkMap,
	wanted: Map<string, Set<string>>,
): Promise<void> {
	if (node.children.size === 0) return;
	for (const [col, child] of node.children) {
		const ref = guessRefTable(col, fkMap);
		if (ref && child.children.size > 0) {
			const bucket = wanted.get(ref) ?? new Set<string>();
			for (const row of rows) {
				const raw = row?.[col];
				if (typeof raw === "string" && raw) bucket.add(raw);
				else if (Array.isArray(raw)) {
					for (const v of raw) if (typeof v === "string" && v) bucket.add(v);
				}
			}
			if (bucket.size) wanted.set(ref, bucket);
			continue;
		}
		const nested: DbRow[] = [];
		for (const row of rows) {
			const raw = row?.[col];
			if (raw == null) continue;
			if (Array.isArray(raw)) {
				for (const v of raw) if (v && typeof v === "object") nested.push(v as DbRow);
			} else if (typeof raw === "object") {
				nested.push(raw as DbRow);
			}
		}
		if (nested.length) await collectFkIdsNested(nested, child, fkMap, wanted);
	}
}

/** Heuristica: `itemId` → `items`, `userId` → `users`, `categoryId` → `categories`. */
function guessRefTable(col: string, fkMap: FkMap): string | null {
	if (!col.endsWith("Id")) return null;
	const base = col.slice(0, -2);
	if (!base) return null;
	// Candidati in ordine: <base>s, <base>es, <base>
	const candidates = [`${base}s`, `${base}es`, base, `${base}ies`];
	const tables = new Set(Object.keys(fkMap));
	for (const c of candidates) if (tables.has(c)) return c;
	return null;
}

/**
 * Risolve tutti gli id raccolti. Una fetch per tabella.
 * `Map<refTable, Map<id, DbRow>>`.
 */
async function fetchAll(
	wanted: Map<string, Set<string>>,
	fetcher: BatchFetcher,
): Promise<Map<string, Map<string, DbRow>>> {
	const out = new Map<string, Map<string, DbRow>>();
	const tasks: Promise<void>[] = [];
	for (const [table, ids] of wanted) {
		if (ids.size === 0) continue;
		tasks.push(
			fetcher(table, [...ids]).then((m) => {
				out.set(table, m);
			}),
		);
	}
	await Promise.all(tasks);
	return out;
}

type Resolved = Map<string, Map<string, DbRow>>;

function projectRow(
	row: DbRow,
	node: SelectNode,
	table: string,
	fkMap: FkMap,
	resolved: Resolved,
): Record<string, unknown> {
	const out: Record<string, unknown> = {};
	// id è sempre incluso (identità della riga).
	if (row.id !== undefined) out.id = row.id;
	if (node.children.size === 0) {
		return { ...row };
	}
	for (const [col, child] of node.children) {
		const raw = (row as Record<string, unknown>)[col];
		const refTable = fkMap[table]?.[col];
		if (child.children.size === 0) {
			// Leaf semplice: copia valore come-è.
			out[col] = raw;
			continue;
		}
		if (refTable) {
			// FK singola o array.
			if (Array.isArray(raw)) {
				out[col] = raw.map((id) => {
					if (typeof id !== "string") return id;
					const target = resolved.get(refTable)?.get(id);
					if (!target) return { id };
					return projectRow(target, child, refTable, fkMap, resolved);
				});
			} else if (typeof raw === "string") {
				const target = resolved.get(refTable)?.get(raw);
				out[col] = target ? projectRow(target, child, refTable, fkMap, resolved) : { id: raw };
			} else {
				out[col] = raw ?? null;
			}
			continue;
		}
		// Non FK: plain object / array di oggetti → discende.
		if (Array.isArray(raw)) {
			out[col] = raw.map((v) => {
				if (v && typeof v === "object") return projectNested(v as DbRow, child, fkMap, resolved);
				return v;
			});
		} else if (raw && typeof raw === "object") {
			out[col] = projectNested(raw as DbRow, child, fkMap, resolved);
		} else {
			out[col] = raw;
		}
	}
	return out;
}

function projectNested(
	row: DbRow,
	node: SelectNode,
	fkMap: FkMap,
	resolved: Resolved,
): Record<string, unknown> {
	const out: Record<string, unknown> = {};
	if (node.children.size === 0) return { ...row };
	for (const [col, child] of node.children) {
		const raw = (row as Record<string, unknown>)[col];
		const ref = guessRefTable(col, fkMap);
		if (child.children.size === 0) {
			out[col] = raw;
			continue;
		}
		if (ref) {
			if (Array.isArray(raw)) {
				out[col] = raw.map((id) => {
					if (typeof id !== "string") return id;
					const target = resolved.get(ref)?.get(id);
					return target ? projectRow(target, child, ref, fkMap, resolved) : { id };
				});
			} else if (typeof raw === "string") {
				const target = resolved.get(ref)?.get(raw);
				out[col] = target ? projectRow(target, child, ref, fkMap, resolved) : { id: raw };
			} else {
				out[col] = raw ?? null;
			}
			continue;
		}
		if (Array.isArray(raw)) {
			out[col] = raw.map((v) => {
				if (v && typeof v === "object") return projectNested(v as DbRow, child, fkMap, resolved);
				return v;
			});
		} else if (raw && typeof raw === "object") {
			out[col] = projectNested(raw as DbRow, child, fkMap, resolved);
		} else {
			out[col] = raw;
		}
	}
	return out;
}

/**
 * Esegue un `select` completo su un insieme di righe: 1 fetch per tabella (batched, deduplicato).
 * `fetcher` riceve `ids` e torna una Map id→row (tipicamente `byId` ripetuto o un loader custom).
 */
export async function applySelect(
	rows: readonly DbRow[],
	select: readonly string[] | undefined,
	table: string,
	fkMap: FkMap,
	fetcher: BatchFetcher,
): Promise<DbRow[] | Record<string, unknown>[]> {
	if (!select || select.length === 0) return [...rows];
	const node = parseSelect(select);

	// Se esiste SOLO il placeholder radice (nessun child), output = righe intere.
	if (node.children.size === 0) return [...rows];

	// Caso speciale: se nessun path ha figli (tutte "leaf") E non ci sono FK,
	// basta proiettare sui campi richiesti senza fetch aggiuntivi.
	const wanted = new Map<string, Set<string>>();
	await collectFkIds(rows, node, table, fkMap, wanted);

	const resolved = await fetchAll(wanted, fetcher);

	// Per ogni FK risolta, ricorsivamente raccoglie ulteriori id (join annidati).
	// Esempio: `bookings.customerId.companyId.name` — risolto customerId, ora servono companyId.
	const visited = new Map<string, Set<string>>();
	for (const [tn, idSet] of wanted) visited.set(tn, new Set(idSet));

	let expanded = true;
	while (expanded) {
		expanded = false;
		const next = new Map<string, Set<string>>();
		for (const [tn, idMap] of resolved) {
			const childNodeFor = findChildForTable(node, table, tn, fkMap);
			if (!childNodeFor || childNodeFor.children.size === 0) continue;
			await collectFkIds([...idMap.values()], childNodeFor, tn, fkMap, next);
		}
		for (const [tn, ids] of next) {
			const already = visited.get(tn) ?? new Set<string>();
			const fresh = [...ids].filter((id) => !already.has(id));
			if (fresh.length === 0) continue;
			expanded = true;
			const freshSet = new Set(fresh);
			const fetched = await fetcher(tn, fresh);
			const acc = resolved.get(tn) ?? new Map<string, DbRow>();
			for (const [id, row] of fetched) acc.set(id, row);
			resolved.set(tn, acc);
			for (const id of freshSet) already.add(id);
			visited.set(tn, already);
		}
	}

	return rows.map((r) => projectRow(r, node, table, fkMap, resolved));
}

/**
 * Trova il sottoalbero di `node` che corrisponde alla tabella `target`
 * partendo da `startTable`, attraversando le colonne FK del catalog.
 * Usa una visita BFS limitata ai child che producono ref.
 */
function findChildForTable(
	node: SelectNode,
	startTable: string,
	target: string,
	fkMap: FkMap,
): SelectNode | null {
	// Ricorsione semplice: per ogni child con FK, se refTable == target → match.
	for (const [col, child] of node.children) {
		const ref = fkMap[startTable]?.[col];
		if (ref === target) return child;
		if (ref) {
			const nested = findChildForTable(child, ref, target, fkMap);
			if (nested) return nested;
		} else {
			// Discende nei plain object per FK-by-convenzione dentro array.
			const guess = guessRefTable(col, fkMap);
			if (guess === target) return child;
			if (guess) {
				const nested = findChildForTable(child, guess, target, fkMap);
				if (nested) return nested;
			}
		}
	}
	return null;
}
