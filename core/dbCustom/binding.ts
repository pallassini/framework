import { dlopen, ptr, suffix } from "bun:ffi";
import { existsSync } from "node:fs";
import { join } from "node:path";

const symbols = {
	custom_db_ping: { args: [], returns: "i32" as const },
	custom_db_create: { args: [], returns: "ptr" as const },
	custom_db_destroy: { args: ["ptr"], returns: "void" as const },
	custom_db_put: { args: ["ptr", "ptr", "usize"], returns: "i64" as const },
	custom_db_get_len: { args: ["ptr", "i64"], returns: "i32" as const },
	custom_db_get: { args: ["ptr", "i64", "ptr", "usize"], returns: "i32" as const },
} as const;

type Lib = ReturnType<typeof dlopen<typeof symbols>>;

let cached: Lib | null = null;

const EMPTY = new Uint8Array(1);

function safePtr(buf: Uint8Array): number {
	return buf.byteLength > 0 ? ptr(buf) : ptr(EMPTY);
}

function toPtrNum(p: bigint | number | null): number {
	if (p == null || p === 0) return 0;
	return typeof p === "bigint" ? Number(p) : p;
}

export function resolveZigLibPath(): string | null {
	const base = join(import.meta.dir, "zig", "zig-out");
	const win = join(base, "bin", "custom_db.dll");
	const nix = join(base, "lib", `libcustom_db.${suffix}`);
	if (process.platform === "win32" && existsSync(win)) return win;
	if (existsSync(nix)) return nix;
	return null;
}

export function loadZigDb(): Lib | null {
	if (cached) return cached;
	const path = resolveZigLibPath();
	if (!path) return null;
	try {
		cached = dlopen(path, symbols);
		return cached;
	} catch {
		return null;
	}
}

export type ZigDbApi = {
	ping(): number;
	create(): number;
	destroy(h: number): void;
	put(h: number, data: Uint8Array): bigint;
	getLen(h: number, id: bigint): number;
	get(h: number, id: bigint, out: Uint8Array): number;
};

export function getZigApi(): ZigDbApi | null {
	const l = loadZigDb();
	if (!l) return null;
	const s = l.symbols;
	return {
		ping: () => s.custom_db_ping(),
		create: () => toPtrNum(s.custom_db_create()),
		destroy: (h) => {
			if (h) s.custom_db_destroy(h);
		},
		put: (h, data) => s.custom_db_put(h, safePtr(data), data.byteLength),
		getLen: (h, id) => s.custom_db_get_len(h, id),
		get: (h, id, out) => s.custom_db_get(h, id, safePtr(out), out.byteLength),
	};
}
