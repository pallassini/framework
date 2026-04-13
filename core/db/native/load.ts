import { dlopen, toArrayBuffer } from "bun:ffi";
import { existsSync } from "node:fs";
import { join } from "node:path";

const libFile =
	process.platform === "win32" ? "fwdb.dll" : process.platform === "darwin" ? "libfwdb.dylib" : "libfwdb.so";

function defaultLibPath(): string {
	return join(import.meta.dir, "..", "zig", "zig-out", "bin", libFile);
}

/** Handle opaco ritornato da `fwdb_engine_create` (Bun FFI: number o bigint). */
export type FwdbEnginePtr = number | bigint;

export type FwdbNative = {
	symbols: {
		fwdb_engine_create: () => FwdbEnginePtr;
		/** Path directory UTF-8: primo argomento = `ptr(Uint8Array(path))`. */
		fwdb_engine_open: (dirPtr: FwdbEnginePtr, dirLen: bigint) => FwdbEnginePtr;
		fwdb_engine_destroy: (engine: FwdbEnginePtr) => void;
		/** Snapshot + truncate WAL (0 = ok). */
		fwdb_checkpoint: (engine: FwdbEnginePtr) => number;
		fwdb_table_ensure: (engine: FwdbEnginePtr, namePtr: FwdbEnginePtr, nameLen: bigint) => number;
		fwdb_table_clear: (engine: FwdbEnginePtr, namePtr: FwdbEnginePtr, nameLen: bigint) => number;
		fwdb_row_put: (
			engine: FwdbEnginePtr,
			tn: FwdbEnginePtr,
			tnLen: bigint,
			pk: FwdbEnginePtr,
			pkLen: bigint,
			json: FwdbEnginePtr,
			jsonLen: bigint,
			replace: number,
		) => number;
		fwdb_row_get: (
			engine: FwdbEnginePtr,
			tn: FwdbEnginePtr,
			tnLen: bigint,
			pk: FwdbEnginePtr,
			pkLen: bigint,
			outLen: FwdbEnginePtr,
		) => FwdbEnginePtr;
		fwdb_row_delete: (engine: FwdbEnginePtr, tn: FwdbEnginePtr, tnLen: bigint, pk: FwdbEnginePtr, pkLen: bigint) => number;
		fwdb_table_row_count: (engine: FwdbEnginePtr, tn: FwdbEnginePtr, tnLen: bigint) => bigint;
		fwdb_scan_begin: (engine: FwdbEnginePtr, tn: FwdbEnginePtr, tnLen: bigint) => FwdbEnginePtr;
		fwdb_scan_next_packed: (scan: FwdbEnginePtr, outLen: FwdbEnginePtr) => FwdbEnginePtr;
		fwdb_scan_destroy: (scan: FwdbEnginePtr) => void;
		fwdb_buf_free: (p: FwdbEnginePtr, len: bigint) => void;
	};
	close: () => void;
};

/** Carica `fwdb` (Zig). `FWDB_LIB` = path assoluto; se assente si usa `core/db/zig/zig-out/bin/`. */
export function tryLoadFwdb(): FwdbNative | null {
	if (process.env.FWDB_DISABLE === "1") return null;
	const path = process.env.FWDB_LIB?.trim() || defaultLibPath();
	if (!existsSync(path)) return null;
	return dlopen(path, {
		fwdb_engine_create: { args: [], returns: "ptr" },
		fwdb_engine_open: { args: ["ptr", "u64"], returns: "ptr" },
		fwdb_engine_destroy: { args: ["ptr"], returns: "void" },
		fwdb_checkpoint: { args: ["ptr"], returns: "i32" },
		fwdb_table_ensure: { args: ["ptr", "ptr", "u64"], returns: "i32" },
		fwdb_table_clear: { args: ["ptr", "ptr", "u64"], returns: "i32" },
		fwdb_row_put: {
			args: ["ptr", "ptr", "u64", "ptr", "u64", "ptr", "u64", "i32"],
			returns: "i32",
		},
		fwdb_row_get: { args: ["ptr", "ptr", "u64", "ptr", "u64", "ptr"], returns: "ptr" },
		fwdb_row_delete: { args: ["ptr", "ptr", "u64", "ptr", "u64"], returns: "i32" },
		fwdb_table_row_count: { args: ["ptr", "ptr", "u64"], returns: "u64" },
		fwdb_scan_begin: { args: ["ptr", "ptr", "u64"], returns: "ptr" },
		fwdb_scan_next_packed: { args: ["ptr", "ptr"], returns: "ptr" },
		fwdb_scan_destroy: { args: ["ptr"], returns: "void" },
		fwdb_buf_free: { args: ["ptr", "u64"], returns: "void" },
	}) as unknown as FwdbNative;
}

export function u8(s: string): Uint8Array {
	return new TextEncoder().encode(s);
}

export function readMallocUtf8(lib: FwdbNative, bufPtr: number | bigint, len: number): string {
	if (!bufPtr || !len) return "";
	const addr = typeof bufPtr === "bigint" ? Number(bufPtr) : bufPtr;
	const ab = toArrayBuffer(addr as never, 0, len);
	const s = new TextDecoder().decode(new Uint8Array(ab));
	lib.symbols.fwdb_buf_free(bufPtr as FwdbEnginePtr, BigInt(len));
	return s;
}

/** Legge buffer `fwdb_scan_next_packed` e lo libera. */
export function readScanRowPacked(lib: FwdbNative, bufPtr: number | bigint, total: number): { pk: string; json: string } {
	const addr = typeof bufPtr === "bigint" ? Number(bufPtr) : bufPtr;
	const ab = toArrayBuffer(addr as never, 0, total);
	const dv = new DataView(ab);
	let o = 0;
	const pkL = dv.getUint32(o, true);
	o += 4;
	const pk = new TextDecoder().decode(new Uint8Array(ab, o, pkL));
	o += pkL;
	const jl = dv.getUint32(o, true);
	o += 4;
	const json = new TextDecoder().decode(new Uint8Array(ab, o, jl));
	lib.symbols.fwdb_buf_free(bufPtr as FwdbEnginePtr, BigInt(total));
	return { pk, json };
}
