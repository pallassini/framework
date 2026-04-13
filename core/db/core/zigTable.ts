import { ptr } from "bun:ffi";
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

/** Tabella su motore Zig (PK stringa + payload JSON UTF-8). */
export class ZigTable<T extends DbRow> {
	constructor(
		private readonly lib: FwdbNative,
		private readonly engine: FwdbEnginePtr,
		private readonly table: string,
		private readonly pkField: string = "id",
	) {}

	private rowPk(row: T): string {
		const v = (row as Record<string, unknown>)[this.pkField];
		return String(v ?? "");
	}

	private ensure(): void {
		const t = u8(this.table);
		const rc = this.lib.symbols.fwdb_table_ensure(this.engine, ffiPtr(t), BigInt(t.length));
		if (rc !== 0) throw new Error(`[fwdb] table_ensure ${this.table} -> ${rc}`);
	}

	private loadAllRows(): T[] {
		this.ensure();
		const tb = u8(this.table);
		const scan = this.lib.symbols.fwdb_scan_begin(this.engine, ffiPtr(tb), BigInt(tb.length));
		if (!scan) return [];
		const out: T[] = [];
		const outTotal = new BigUint64Array(1);
		for (;;) {
			const packed = this.lib.symbols.fwdb_scan_next_packed(scan, ffiPtr(outTotal));
			if (!packed) break;
			const total = Number(outTotal[0]);
			const { pk, json } = readScanRowPacked(this.lib, packed as FwdbEnginePtr, total);
			const row = JSON.parse(json) as T;
			if (String((row as Record<string, unknown>)[this.pkField] ?? "") !== pk)
				(row as Record<string, unknown>)[this.pkField] = pk;
			out.push(row);
		}
		this.lib.symbols.fwdb_scan_destroy(scan);
		return out;
	}

	create(rowsInput: T | readonly T[]): T[] {
		this.ensure();
		const rows = Array.isArray(rowsInput) ? rowsInput : [rowsInput];
		const tb = u8(this.table);
		const out: T[] = [];
		for (const row of rows) {
			const id = this.rowPk(row);
			if (!id) throw new Error(`[fwdb] create: ${this.pkField} obbligatorio`);
			const payload = u8(JSON.stringify({ ...row, [this.pkField]: id }));
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
			out.push({ ...row, [this.pkField]: id } as T);
		}
		return out;
	}

	find(where?: Where<T>, opts?: FindOptions<T>): T[] {
		const all = this.loadAllRows();
		const hit = all.filter((r) => matchWhere(r, where));
		return applyFindWindow(hit, opts);
	}

	byId(id: string): T | undefined {
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
		return row;
	}

	count(where?: Where<T>): number {
		return this.find(where).length;
	}

	update(where: Where<T>, patch: UpdatePatch<T>): UpdateResult<T> {
		const hit = this.find(where);
		const out: T[] = [];
		const tb = u8(this.table);
		for (const row of hit) {
			const nextPatch = typeof patch === "function" ? patch(row) : patch;
			if (!nextPatch) continue;
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
			out.push(merged);
		}
		return { count: out.length, rows: out };
	}

	delete(where: Where<T>): DeleteResult {
		const hit = this.find(where);
		const tb = u8(this.table);
		const ids: string[] = [];
		for (const row of hit) {
			const pk = u8(this.rowPk(row));
			const rc = this.lib.symbols.fwdb_row_delete(
				this.engine,
				ffiPtr(tb),
				BigInt(tb.length),
				ffiPtr(pk),
				BigInt(pk.length),
			);
			if (rc !== 0) throw new Error(`[fwdb] row_delete ${explainDeleteRc(rc)}`);
			ids.push(this.rowPk(row));
		}
		return { count: ids.length, ids };
	}

	clear(): number {
		this.ensure();
		const tb = u8(this.table);
		const n = Number(this.lib.symbols.fwdb_table_row_count(this.engine, ffiPtr(tb), BigInt(tb.length)));
		const rc = this.lib.symbols.fwdb_table_clear(this.engine, ffiPtr(tb), BigInt(tb.length));
		if (rc !== 0) throw new Error(`[fwdb] table_clear -> ${rc}`);
		return n;
	}
}
