import { getZigApi } from "./binding";

export type DbCustomSmokeResult = {
	ok: true;
	engine: "zig" | "memory";
	ping: number;
	putId: string;
	roundtrip: string;
};

export type DbCustomBenchResult = {
	ok: true;
	engine: "zig" | "memory";
	iterations: number;
	payloadBytes: number;
	totalMs: number;
	/** Put+get completati al secondo (ogni iterazione = 1 put e 1 get). */
	pairsPerSec: number;
};

/** Fallback in-memory se la DLL/.so Zig non c’è (dev senza `zig build`). */
const mem = {
	nextId: 1 as number,
	rows: new Map<number, Uint8Array>(),
	ping: () => 42,
	put(data: Uint8Array): number {
		const id = mem.nextId++;
		mem.rows.set(id, Uint8Array.from(data));
		return id;
	},
	get(id: number): Uint8Array | undefined {
		return mem.rows.get(id);
	},
};

let zigHandle: number | null = null;

function ensureZigHandle(api: NonNullable<ReturnType<typeof getZigApi>>): number {
	if (zigHandle == null || zigHandle === 0) {
		zigHandle = api.create();
		if (!zigHandle) throw new Error("[dbCustom] custom_db_create failed");
	}
	return zigHandle;
}

export function smokeTest(): DbCustomSmokeResult {
	const payload = new TextEncoder().encode('{"hello":"dbCustom","ts":' + Date.now() + "}");

	const zig = getZigApi();
	if (zig) {
		const ping = zig.ping();
		if (ping !== 42) throw new Error(`[dbCustom] zig ping expected42, got ${ping}`);
		const h = ensureZigHandle(zig);
		const id = zig.put(h, payload);
		if (id <= 0n) throw new Error("[dbCustom] zig put failed");
		const len = zig.getLen(h, id);
		if (len <= 0) throw new Error("[dbCustom] zig get_len failed");
		const out = new Uint8Array(len);
		const n = zig.get(h, id, out);
		if (n !== len) throw new Error("[dbCustom] zig get size mismatch");
		return {
			ok: true,
			engine: "zig",
			ping,
			putId: id.toString(),
			roundtrip: new TextDecoder().decode(out),
		};
	}

	const ping = mem.ping();
	const putId = mem.put(payload);
	const got = mem.get(putId);
	if (!got) throw new Error("[dbCustom] memory get failed");
	return {
		ok: true,
		engine: "memory",
		ping,
		putId: String(putId),
		roundtrip: new TextDecoder().decode(got),
	};
}

function clampInt(n: number, lo: number, hi: number): number {
	if (!Number.isFinite(n)) return lo;
	return Math.min(hi, Math.max(lo, Math.trunc(n)));
}

/**
 * Stress put/get in-process (non è SQL relazionale: misura throughput del motore blob attuale).
 */
export function benchPutGet(opts: { iterations: number; payloadBytes?: number }): DbCustomBenchResult {
	const iterations = clampInt(opts.iterations, 1, 200_000);
	const payloadBytes = clampInt(opts.payloadBytes ?? 64, 16, 4096);
	const payload = new Uint8Array(payloadBytes);
	crypto.getRandomValues(payload);

	const zig = getZigApi();
	const t0 = performance.now();

	if (zig) {
		const h = ensureZigHandle(zig);
		for (let i = 0; i < iterations; i++) {
			payload[0] = i & 0xff;
			payload[1] = (i >> 8) & 0xff;
			const id = zig.put(h, payload);
			if (id <= 0n) throw new Error("[dbCustom] bench zig put failed");
			const len = zig.getLen(h, id);
			if (len !== payload.byteLength) throw new Error("[dbCustom] bench zig len mismatch");
			const out = new Uint8Array(len);
			const n = zig.get(h, id, out);
			if (n !== len) throw new Error("[dbCustom] bench zig get mismatch");
		}
	} else {
		for (let i = 0; i < iterations; i++) {
			payload[0] = i & 0xff;
			payload[1] = (i >> 8) & 0xff;
			const id = mem.put(payload);
			const got = mem.get(id);
			if (!got || got.byteLength !== payload.byteLength) throw new Error("[dbCustom] bench memory get failed");
		}
	}

	const totalMs = performance.now() - t0;
	const pairsPerSec = totalMs > 0 ? (iterations * 1000) / totalMs : 0;

	return {
		ok: true,
		engine: zig ? "zig" : "memory",
		iterations,
		payloadBytes,
		totalMs: Math.round(totalMs * 100) / 100,
		pairsPerSec: Math.round(pairsPerSec),
	};
}
