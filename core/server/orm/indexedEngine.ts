import { matchRow, type WhereClause } from "../../client/db/orm/where";
import type { Engine } from "../../client/db/orm/engine";

function isScalar(v: unknown): boolean {
	if (v === null) return true;
	const t = typeof v;
	return t === "string" || t === "number" || t === "boolean";
}

function idxKey(field: string, value: unknown): string {
	return `${field}\x1e${JSON.stringify(value)}`;
}

function intersectSets(a: Set<string>, b: Set<string>): Set<string> {
	const out = new Set<string>();
	for (const x of a) {
		if (b.has(x)) out.add(x);
	}
	return out;
}

/**
 * Come MemoryEngine ma con **indici invertiti automatici** su ogni campo scalare (eq → lookup O(k) su candidati).
 * Join e filtri composti usano intersezione indici quando possibile; altrimenti scan.
 */
export class IndexedMemoryEngine implements Engine {
	readonly kind = "indexed" as const;
	private readonly tables = new Map<string, Map<string, Record<string, unknown>>>();
	/** tablePath → idxKey → Set<pk> */
	private readonly index = new Map<string, Map<string, Set<string>>>();

	private tableMap(path: string): Map<string, Record<string, unknown>> {
		let m = this.tables.get(path);
		if (!m) {
			m = new Map();
			this.tables.set(path, m);
		}
		return m;
	}

	private idxMap(path: string): Map<string, Set<string>> {
		let m = this.index.get(path);
		if (!m) {
			m = new Map();
			this.index.set(path, m);
		}
		return m;
	}

	private indexAdd(tablePath: string, pk: string, row: Record<string, unknown>): void {
		const im = this.idxMap(tablePath);
		for (const [field, val] of Object.entries(row)) {
			if (!isScalar(val)) continue;
			const k = idxKey(field, val);
			let s = im.get(k);
			if (!s) {
				s = new Set();
				im.set(k, s);
			}
			s.add(pk);
		}
	}

	private indexRemoveRow(tablePath: string, row: Record<string, unknown>, pk: string): void {
		const im = this.idxMap(tablePath);
		for (const [field, val] of Object.entries(row)) {
			if (!isScalar(val)) continue;
			const k = idxKey(field, val);
			im.get(k)?.delete(pk);
		}
	}

	private candidatePksFromWhere(tablePath: string, where: WhereClause | undefined): Set<string> | null {
		if (!where || where.and.length === 0) return null;
		const eqAtoms = where.and.filter((a) => a.kind === "eq");
		if (eqAtoms.length !== where.and.length) return null;
		const im = this.index.get(tablePath);
		if (!im) return new Set();

		let cand: Set<string> | null = null;
		for (const a of eqAtoms) {
			const k = idxKey(a.field, a.value);
			const s = im.get(k) ?? new Set();
			cand = cand === null ? new Set(s) : intersectSets(cand, s);
			if (cand.size === 0) return cand;
		}
		return cand;
	}

	async insert(tablePath: string, pkField: string, row: Record<string, unknown>): Promise<Record<string, unknown>> {
		const m = this.tableMap(tablePath);
		let pk = row[pkField];
		if (pk === undefined || pk === null) pk = crypto.randomUUID();
		const pkStr = String(pk);
		const copy = { ...row, [pkField]: pkStr };
		m.set(pkStr, copy);
		this.indexAdd(tablePath, pkStr, copy);
		return copy;
	}

	async update(
		tablePath: string,
		pkField: string,
		clause: WhereClause,
		patch: Record<string, unknown>,
	): Promise<number> {
		const m = this.tableMap(tablePath);
		let n = 0;
		for (const [_k, row] of m) {
			if (!matchRow(row, clause)) continue;
			this.indexRemoveRow(tablePath, row, String(row[pkField]));
			Object.assign(row, patch, { [pkField]: row[pkField] });
			this.indexAdd(tablePath, String(row[pkField]), row);
			n++;
		}
		return n;
	}

	async delete(tablePath: string, pkField: string, clause: WhereClause): Promise<number> {
		const m = this.tableMap(tablePath);
		const toDel: string[] = [];
		for (const [pk, row] of m) {
			if (matchRow(row, clause)) toDel.push(pk);
		}
		for (const pk of toDel) {
			const row = m.get(pk);
			if (row) this.indexRemoveRow(tablePath, row, pk);
			m.delete(pk);
		}
		return toDel.length;
	}

	/** Inserimento batch sincrono (seed massivi senza Promise per riga). */
	insertManySync(tablePath: string, pkField: string, rows: readonly Record<string, unknown>[]): void {
		const m = this.tableMap(tablePath);
		for (const row of rows) {
			let pk = row[pkField];
			if (pk === undefined || pk === null) pk = crypto.randomUUID();
			const pkStr = String(pk);
			const copy = { ...row, [pkField]: pkStr };
			m.set(pkStr, copy);
			this.indexAdd(tablePath, pkStr, copy);
		}
	}

	/** Rimuove tutte le tabelle il cui path inizia con `prefix` (es. `/app/dash`). */
	clearTablePrefix(prefix: string): void {
		for (const tp of [...this.tables.keys()]) {
			if (tp.startsWith(prefix)) {
				this.tables.delete(tp);
				this.index.delete(tp);
			}
		}
	}

	async findMany(
		tablePath: string,
		opts: { where?: WhereClause | undefined; limit?: number; offset?: number },
	): Promise<Record<string, unknown>[]> {
		const m = this.tableMap(tablePath);
		const where = opts.where;
		const off = Math.max(0, opts.offset ?? 0);
		const lim = opts.limit ?? Number.POSITIVE_INFINITY;

		const cand = this.candidatePksFromWhere(tablePath, where);
		const sourceRows: Iterable<Record<string, unknown>> =
			cand !== null
				? (function* () {
						for (const pk of cand) {
							const row = m.get(pk);
							if (row) yield row;
						}
					})()
				: m.values();

		const out: Record<string, unknown>[] = [];
		let skipped = 0;
		for (const row of sourceRows) {
			if (where && !matchRow(row, where)) continue;
			if (skipped < off) {
				skipped++;
				continue;
			}
			if (out.length >= lim) break;
			out.push(row);
		}
		return out;
	}
}
