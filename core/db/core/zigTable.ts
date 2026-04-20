import { ptr } from "bun:ffi";
import { compactUndefinedKeys } from "./compact-patch";
import { applyFindWindow, matchWhere } from "./where";
import type {
	DeleteResult,
	DbRow,
	FindOptions,
	UpdatePatch,
	UpdateResult,
	Where,
} from "./types";
import { readMallocUtf8, readScanRowPacked, u8, type FwdbEnginePtr, type FwdbNative } from "../native/load";

function ffiPtr(x: Uint8Array | BigUint64Array): FwdbEnginePtr {
	return ptr(x) as FwdbEnginePtr;
}

function explainPutRc(rc: number): string {
	switch (rc) {
		case 3:
			return "duplicate key";
		case 5:
			return "foreign key violation";
		case 6:
			return "unique index violation";
		default:
			return `code ${rc}`;
	}
}

function explainDeleteRc(rc: number): string {
	switch (rc) {
		case 8:
			return "RESTRICT: child rows still reference this key";
		default:
			return `code ${rc}`;
	}
}

/**
 * Tabella su motore Zig (PK stringa + payload JSON UTF-8).
 *
 * Performance: cache in-memory `rowsByPk` popolata dallo scan completo alla prima
 * lettura. Tutte le mutazioni (`create`/`update`/`delete`/`clear`) aggiornano
 * il cache atomicamente, così `find` / `byId` successivi non rileggono dal disco.
 */
export class ZigTable<T extends DbRow> {
	constructor(
		private readonly lib: FwdbNative,
		private readonly engine: FwdbEnginePtr,
		private readonly table: string,
		private readonly pkField: string = "id",
	) {}

	/** `null` finché non è stato caricato almeno una volta. */
	private rowsByPk: Map<string, T> | null = null;

	private rowPk(row: T): string {
		const v = (row as Record<string, unknown>)[this.pkField];
		return String(v ?? "");
	}

	private ensure(): void {
		const t = u8(this.table);
		const rc = this.lib.symbols.fwdb_table_ensure(this.engine, ffiPtr(t), BigInt(t.length));
		if (rc !== 0) throw new Error(`[fwdb] table_ensure ${this.table} -> ${rc}`);
	}

	private loadAllRows(): Map<string, T> {
		this.ensure();
		const tb = u8(this.table);
		const scan = this.lib.symbols.fwdb_scan_begin(this.engine, ffiPtr(tb), BigInt(tb.length));
		const map = new Map<string, T>();
		if (!scan) return map;
		const outTotal = new BigUint64Array(1);
		for (;;) {
			const packed = this.lib.symbols.fwdb_scan_next_packed(scan, ffiPtr(outTotal));
			if (!packed) break;
			const total = Number(outTotal[0]);
			const { pk, json } = readScanRowPacked(this.lib, packed as FwdbEnginePtr, total);
			const row = JSON.parse(json) as T;
			if (String((row as Record<string, unknown>)[this.pkField] ?? "") !== pk)
				(row as Record<string, unknown>)[this.pkField] = pk;
			map.set(pk, row);
		}
		this.lib.symbols.fwdb_scan_destroy(scan);
		return map;
	}

	/** Cache lazy: la prima volta scansiona il motore, dopo serve da RAM. */
	private rows(): Map<string, T> {
		if (this.rowsByPk) return this.rowsByPk;
		this.rowsByPk = this.loadAllRows();
		return this.rowsByPk;
	}

	/** Invalida tutto il cache (usato quando il motore viene ricaricato / schema HMR). */
	invalidateCache(): void {
		this.rowsByPk = null;
	}

	create(rowsInput: T | readonly T[]): T[] {
		this.ensure();
		const rowsArr = Array.isArray(rowsInput) ? rowsInput : [rowsInput];
		const tb = u8(this.table);
		const out: T[] = [];
		const cache = this.rows();
		for (const row of rowsArr) {
			const id = this.rowPk(row);
			if (!id) throw new Error(`[fwdb] create: ${this.pkField} obbligatorio`);
			const full = { ...row, [this.pkField]: id } as T;
			const payload = u8(JSON.stringify(full));
			const pk = u8(id);
			const rc = this.lib.symbols.fwdb_row_put(
				this.engine,
				ffiPtr(tb),
				BigInt(tb.length),
				ffiPtr(pk),
				BigInt(pk.length),
				ffiPtr(payload),
				BigInt(payload.length),
				0,
			);
			if (rc === 3) throw new Error(`[fwdb] duplicate key "${id}"`);
			if (rc !== 0) throw new Error(`[fwdb] row_put ${explainPutRc(rc)}`);
			cache.set(id, full);
			out.push(full);
		}
		return out;
	}

	find(where?: Where<T>, opts?: FindOptions<T>): T[] {
		const cache = this.rows();
		// Fast-path: `byId` esplicito via `where.id = "..."` / `$eq`.
		const idEq = fastIdEq(where);
		if (idEq !== undefined) {
			const row = cache.get(idEq);
			const hit = row && matchWhere(row, where) ? [row] : [];
			return applyFindWindow(hit, opts);
		}
		const hit: T[] = [];
		for (const row of cache.values()) {
			if (matchWhere(row, where)) hit.push(row);
		}
		return applyFindWindow(hit, opts);
	}

	byId(id: string): T | undefined {
		const cache = this.rows();
		const cached = cache.get(id);
		if (cached) return cached;
		// Fallback FFI nel caso il cache fosse stato invalidato o la row appena creata da un altro processo.
		this.ensure();
		const tb = u8(this.table);
		const pk = u8(id);
		const outLen = new BigUint64Array(1);
		const p = this.lib.symbols.fwdb_row_get(
			this.engine,
			ffiPtr(tb),
			BigInt(tb.length),
			ffiPtr(pk),
			BigInt(pk.length),
			ffiPtr(outLen),
		);
		const len = Number(outLen[0]);
		if (!p || !len) return undefined;
		const json = readMallocUtf8(this.lib, p as FwdbEnginePtr, len);
		const row = JSON.parse(json) as T;
		if (String((row as Record<string, unknown>)[this.pkField] ?? "") !== id)
			(row as Record<string, unknown>)[this.pkField] = id;
		cache.set(id, row);
		return row;
	}

	count(where?: Where<T>): number {
		if (!where) return this.rows().size;
		return this.find(where).length;
	}

	update(where: Where<T>, patch: UpdatePatch<T>): UpdateResult<T> {
		const hit = this.find(where);
		const out: T[] = [];
		const tb = u8(this.table);
		const cache = this.rows();
		for (const row of hit) {
			const nextPatchRaw = typeof patch === "function" ? patch(row) : patch;
			if (!nextPatchRaw) continue;
			const nextPatch = compactUndefinedKeys(nextPatchRaw as Record<string, unknown>) as Partial<
				Omit<T, "id">
			>;
			const curPk = this.rowPk(row);
			const merged = { ...row, ...nextPatch, [this.pkField]: curPk } as T;
			const payload = u8(JSON.stringify(merged));
			const pk = u8(curPk);
			const rc = this.lib.symbols.fwdb_row_put(
				this.engine,
				ffiPtr(tb),
				BigInt(tb.length),
				ffiPtr(pk),
				BigInt(pk.length),
				ffiPtr(payload),
				BigInt(payload.length),
				1,
			);
			if (rc !== 0) throw new Error(`[fwdb] row_put(update) ${explainPutRc(rc)}`);
			cache.set(curPk, merged);
			out.push(merged);
		}
		return { count: out.length, rows: out };
	}

	delete(where: Where<T>): DeleteResult {
		const hit = this.find(where);
		const tb = u8(this.table);
		const cache = this.rows();
		const ids: string[] = [];
		for (const row of hit) {
			const id = this.rowPk(row);
			const pk = u8(id);
			const rc = this.lib.symbols.fwdb_row_delete(
				this.engine,
				ffiPtr(tb),
				BigInt(tb.length),
				ffiPtr(pk),
				BigInt(pk.length),
			);
			if (rc !== 0) throw new Error(`[fwdb] row_delete ${explainDeleteRc(rc)}`);
			cache.delete(id);
			ids.push(id);
		}
		return { count: ids.length, ids };
	}

	clear(): number {
		this.ensure();
		const tb = u8(this.table);
		const n = Number(this.lib.symbols.fwdb_table_row_count(this.engine, ffiPtr(tb), BigInt(tb.length)));
		const rc = this.lib.symbols.fwdb_table_clear(this.engine, ffiPtr(tb), BigInt(tb.length));
		if (rc !== 0) throw new Error(`[fwdb] table_clear -> ${rc}`);
		this.rowsByPk = new Map();
		return n;
	}
}

function fastIdEq<T extends DbRow>(where: Where<T> | undefined): string | undefined {
	if (!where) return undefined;
	const id = (where as Record<string, unknown>).id;
	if (typeof id === "string") return id;
	if (id && typeof id === "object" && !Array.isArray(id)) {
		const eq = (id as { $eq?: unknown }).$eq;
		if (typeof eq === "string") return eq;
	}
	return undefined;
}
