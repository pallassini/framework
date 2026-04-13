import { matchRow, type WhereClause } from "./where";

export interface Engine {
	readonly kind: "memory" | "zig_mirror";

	insert(tablePath: string, pkField: string, row: Record<string, unknown>): Promise<Record<string, unknown>>;
	update(
		tablePath: string,
		pkField: string,
		clause: WhereClause,
		patch: Record<string, unknown>,
	): Promise<number>;
	delete(tablePath: string, pkField: string, clause: WhereClause): Promise<number>;
	findMany(
		tablePath: string,
		opts: { where?: WhereClause | undefined; limit?: number; offset?: number },
	): Promise<Record<string, unknown>[]>;
}

/** Storage in-RAM: path tabella = cartelle infinite + nome tabella. */
export class MemoryEngine implements Engine {
	readonly kind = "memory" as const;
	private readonly tables = new Map<string, Map<string, Record<string, unknown>>>();

	private tableMap(path: string): Map<string, Record<string, unknown>> {
		let m = this.tables.get(path);
		if (!m) {
			m = new Map();
			this.tables.set(path, m);
		}
		return m;
	}

	async insert(tablePath: string, pkField: string, row: Record<string, unknown>): Promise<Record<string, unknown>> {
		const m = this.tableMap(tablePath);
		let pk = row[pkField];
		if (pk === undefined || pk === null) {
			pk = crypto.randomUUID();
		}
		const pkStr = String(pk);
		const copy = { ...row, [pkField]: pkStr };
		m.set(pkStr, copy);
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
			if (matchRow(row, clause)) {
				Object.assign(row, patch, { [pkField]: row[pkField] });
				n++;
			}
		}
		return n;
	}

	async delete(tablePath: string, pkField: string, clause: WhereClause): Promise<number> {
		const m = this.tableMap(tablePath);
		const toDel: string[] = [];
		for (const [pk, row] of m) {
			if (matchRow(row, clause)) toDel.push(pk);
		}
		for (const pk of toDel) m.delete(pk);
		return toDel.length;
	}

	async findMany(
		tablePath: string,
		opts: { where?: WhereClause | undefined; limit?: number; offset?: number },
	): Promise<Record<string, unknown>[]> {
		const m = this.tableMap(tablePath);
		const where = opts.where;
		const out: Record<string, unknown>[] = [];
		const off = Math.max(0, opts.offset ?? 0);
		const lim = opts.limit ?? Number.POSITIVE_INFINITY;
		let skipped = 0;
		for (const row of m.values()) {
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
