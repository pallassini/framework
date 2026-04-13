import { getZigApi } from "./binding";

export type DbCustomSmokeResult = {
	ok: true;
	engine: "zig" | "memory";
	ping: number;
	putId: string;
	roundtrip: string;
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
