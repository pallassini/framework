import type { DbRow, DbScalar, FindOptions, Where, WhereOps, WhereValue } from "./types";

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isScalar(value: unknown): value is DbScalar {
	return value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

/** `filter === null` include proprietà assente (`undefined`) o `null` sul record (campi opzionali / soft-delete). */
function eqScalarMatch(rowVal: unknown, filterVal: unknown): boolean {
	if (filterVal === null) return rowVal == null;
	return rowVal === filterVal;
}

function matchOps(value: unknown, ops: WhereOps<unknown>): boolean {
	if (ops.$eq !== undefined && !eqScalarMatch(value, ops.$eq)) return false;
	/** `$ne: null` = “valorizzato” come in SQL `IS NOT NULL`: esclude `null` e proprietà assente (`undefined`). */
	if (ops.$ne !== undefined) {
		if (ops.$ne === null ? value == null : value === ops.$ne) return false;
	}
	if (ops.$in && !ops.$in.includes(value)) return false;
	if (ops.$nin && ops.$nin.includes(value)) return false;
	if (ops.$lt !== undefined && !(typeof value === "number" && typeof ops.$lt === "number" && value < ops.$lt)) {
		return false;
	}
	if (ops.$lte !== undefined && !(typeof value === "number" && typeof ops.$lte === "number" && value <= ops.$lte)) {
		return false;
	}
	if (ops.$gt !== undefined && !(typeof value === "number" && typeof ops.$gt === "number" && value > ops.$gt)) {
		return false;
	}
	if (ops.$gte !== undefined && !(typeof value === "number" && typeof ops.$gte === "number" && value >= ops.$gte)) {
		return false;
	}
	return true;
}

export function matchWhere<T extends DbRow>(row: T, where: Where<T> | undefined): boolean {
	if (!where) return true;
	if (where.$and && where.$and.length > 0) {
		for (const child of where.$and) {
			if (!matchWhere(row, child)) return false;
		}
	}
	if (where.$or && where.$or.length > 0) {
		let any = false;
		for (const child of where.$or) {
			if (matchWhere(row, child)) {
				any = true;
				break;
			}
		}
		if (!any) return false;
	}

	for (const [k, raw] of Object.entries(where)) {
		if (k === "$and" || k === "$or") continue;
		const value = row[k];
		if (raw === undefined) continue;
		if (isObject(raw)) {
			if (!matchOps(value, raw as WhereOps<unknown>)) return false;
			continue;
		}
		if (!eqScalarMatch(value, raw)) return false;
	}
	return true;
}

export type EqAtom = { field: string; values: readonly DbScalar[] };

function atomFromValue(field: string, raw: WhereValue<unknown> | undefined): EqAtom | null {
	if (raw === undefined) return null;
	if (isScalar(raw)) return { field, values: [raw] };
	if (!isObject(raw)) return null;
	if (raw.$eq !== undefined && isScalar(raw.$eq)) {
		return { field, values: [raw.$eq] };
	}
	if (raw.$in && Array.isArray(raw.$in)) {
		const vals = raw.$in.filter(isScalar);
		if (vals.length > 0) return { field, values: vals };
	}
	return null;
}

/** Usa solo filtri eq/in combinati in and; il resto torna null (fallback a scan). */
export function extractEqAtoms<T extends DbRow>(where: Where<T> | undefined): EqAtom[] | null {
	if (!where) return [];
	if (where.$or && where.$or.length > 0) return null;
	const out: EqAtom[] = [];

	for (const [k, raw] of Object.entries(where)) {
		if (k === "$or") continue;
		if (k === "$and") {
			const children = where.$and ?? [];
			for (const child of children) {
				const childAtoms = extractEqAtoms(child);
				if (childAtoms === null) return null;
				out.push(...childAtoms);
			}
			continue;
		}
		const atom = atomFromValue(k, raw as WhereValue<unknown>);
		if (!atom) return null;
		out.push(atom);
	}
	return out;
}

export function applyFindWindow<T extends DbRow>(rows: T[], opts?: FindOptions<T>): T[] {
	if (!opts) return rows;
	const source = [...rows];
	if (opts.orderBy) {
		const k = opts.orderBy;
		const sign = opts.direction === "desc" ? -1 : 1;
		source.sort((a, b) => {
			const av = a[k];
			const bv = b[k];
			if (av === bv) return 0;
			if (av == null || bv == null) {
				if (av == null && bv == null) return 0;
				if (av == null) return -1 * sign;
				return 1 * sign;
			}
			if (av < bv) return -1 * sign;
			return 1 * sign;
		});
	}

	const off = Math.max(0, opts.offset ?? 0);
	const lim = opts.limit;
	if (lim === undefined) return source.slice(off);
	return source.slice(off, off + Math.max(0, lim));
}
