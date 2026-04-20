import { compactUndefinedKeys } from "./compact-patch";
import { applyFindWindow, extractEqAtoms, matchWhere } from "./where";
import type {
	DeleteResult,
	DbRow,
	DbScalar,
	FindOptions,
	UpdatePatch,
	UpdateResult,
	Where,
} from "./types";

function scalarKey(value: DbScalar): string {
	return `${typeof value}:${String(value)}`;
}

function intersect(a: Set<string>, b: Set<string>): Set<string> {
	const out = new Set<string>();
	for (const x of a) {
		if (b.has(x)) out.add(x);
	}
	return out;
}

function unionSets(sets: readonly Set<string>[]): Set<string> {
	const out = new Set<string>();
	for (const s of sets) {
		for (const x of s) out.add(x);
	}
	return out;
}

function toArray<T>(value: T | readonly T[]): T[] {
	return (Array.isArray(value) ? value : [value]) as T[];
}

export class IndexedTable<T extends DbRow> {
	private readonly rows = new Map<string, T>();
	private readonly index = new Map<string, Map<string, Set<string>>>();

	private idxMap(field: string): Map<string, Set<string>> {
		let m = this.index.get(field);
		if (!m) {
			m = new Map<string, Set<string>>();
			this.index.set(field, m);
		}
		return m;
	}

	private addToIndex(id: string, row: T): void {
		for (const [field, raw] of Object.entries(row)) {
			if (raw === null || typeof raw === "string" || typeof raw === "number" || typeof raw === "boolean") {
				const key = scalarKey(raw);
				const fieldMap = this.idxMap(field);
				let ids = fieldMap.get(key);
				if (!ids) {
					ids = new Set<string>();
					fieldMap.set(key, ids);
				}
				ids.add(id);
			}
		}
	}

	private removeFromIndex(id: string, row: T): void {
		for (const [field, raw] of Object.entries(row)) {
			if (raw === null || typeof raw === "string" || typeof raw === "number" || typeof raw === "boolean") {
				const key = scalarKey(raw);
				this.index.get(field)?.get(key)?.delete(id);
			}
		}
	}

	private candidateIds(where: Where<T> | undefined): Set<string> | null {
		const atoms = extractEqAtoms(where);
		if (atoms === null) return null;
		if (atoms.length === 0) return null;

		let cand: Set<string> | null = null;
		for (const atom of atoms) {
			const fieldMap = this.index.get(atom.field);
			if (!fieldMap) return new Set<string>();
			const options = atom.values.map((v) => fieldMap.get(scalarKey(v)) ?? new Set<string>());
			const union = unionSets(options);
			cand = cand ? intersect(cand, union) : union;
			if (cand.size === 0) return cand;
		}
		return cand;
	}

	create(rowsInput: T | readonly T[]): T[] {
		const rows = toArray(rowsInput);
		const out: T[] = [];
		for (const row of rows) {
			const id = String(row.id ?? crypto.randomUUID());
			if (this.rows.has(id)) throw new Error(`[db] duplicate id "${id}"`);
			const next = { ...row, id } as T;
			this.rows.set(id, next);
			this.addToIndex(id, next);
			out.push(next);
		}
		return out;
	}

	find(where?: Where<T>, opts?: FindOptions<T>): T[] {
		const cand = this.candidateIds(where);
		const source: Iterable<T> =
			cand === null
				? this.rows.values()
				: (function* (rows: Map<string, T>, ids: Set<string>) {
						for (const id of ids) {
							const row = rows.get(id);
							if (row) yield row;
						}
					})(this.rows, cand);
		const out: T[] = [];
		for (const row of source) {
			if (!matchWhere(row, where)) continue;
			out.push(row);
		}
		return applyFindWindow(out, opts);
	}

	byId(id: string): T | undefined {
		return this.rows.get(id);
	}

	count(where?: Where<T>): number {
		return this.find(where).length;
	}

	update(where: Where<T>, patch: UpdatePatch<T>): UpdateResult<T> {
		const hit = this.find(where);
		const out: T[] = [];
		for (const row of hit) {
			const nextPatchRaw =
				typeof patch === "function" ? patch(row) : patch;
			if (!nextPatchRaw) continue;
			const nextPatch = compactUndefinedKeys(nextPatchRaw as Record<string, unknown>) as Partial<
				Omit<T, "id">
			>;
			this.removeFromIndex(row.id, row);
			const next = { ...row, ...nextPatch, id: row.id } as T;
			this.rows.set(row.id, next);
			this.addToIndex(next.id, next);
			out.push(next);
		}
		return { count: out.length, rows: out };
	}

	delete(where: Where<T>): DeleteResult {
		const hit = this.find(where);
		const ids: string[] = [];
		for (const row of hit) {
			this.removeFromIndex(row.id, row);
			this.rows.delete(row.id);
			ids.push(row.id);
		}
		return { count: ids.length, ids };
	}

	clear(): number {
		const n = this.rows.size;
		this.rows.clear();
		this.index.clear();
		return n;
	}
}
