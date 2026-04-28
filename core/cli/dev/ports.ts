import { createConnection, createServer } from "node:net";
import { SERVER_RPC_HOST } from "../../server/routes/config";

const RPC_START = 8787;
const RPC_SPAN = 200;

/**
 * `bindHost` deve coincidere con chi poi fa `listen` su quella porta
 * (es. RPC dev su `SERVER_RPC_HOST`, Vite `host: true` → `0.0.0.0`).
 */
export async function isPortFree(port: number, bindHost: string): Promise<boolean> {
	return await new Promise((resolve) => {
		const s = createServer();
		s.once("error", () => resolve(false));
		s.once("listening", () => s.close(() => resolve(true)));
		s.listen(port, bindHost);
	});
}

/** Qualcosa accetta già TCP su 127.0.0.1:port (es. altro Vite HTTPS): più affidabile del solo `listen` su Windows. */
export async function localhostTcpPortBusy(port: number): Promise<boolean> {
	return await new Promise((resolve) => {
		const s = createConnection({ port, host: "127.0.0.1" });
		let settled = false;
		const done = (busy: boolean) => {
			if (settled) return;
			settled = true;
			s.removeAllListeners();
			s.destroy();
			resolve(busy);
		};
		s.once("connect", () => done(true));
		s.once("error", () => done(false));
		s.setTimeout(600, () => done(false));
	});
}

export async function pickPort(start: number, span: number, bindHost: string): Promise<number> {
	for (let p = start; p < start + span; p++) {
		if (await isPortFree(p, bindHost)) return p;
	}
	throw new Error(`nessuna porta libera in ${start}-${start + span - 1}`);
}

/** Vite `host: true`: la porta deve essere libera su loopback e su IPv4 wildcard (evita falsi negativi su Windows). */
export async function pickViteDevPort(start: number, span: number): Promise<number> {
	for (let p = start; p < start + span; p++) {
		const w = await isPortFree(p, "0.0.0.0");
		const l = await isPortFree(p, "127.0.0.1");
		const tcp = await localhostTcpPortBusy(p);
		if (w && l && !tcp) return p;
	}
	throw new Error(`nessuna porta Vite libera in ${start}-${start + span - 1}`);
}

/**
 * Dev: porta RPC fissa da env oppure prima libera su `SERVER_RPC_HOST` (come `Bun.serve` in dev).
 * Ritorna la porta da passare esplicitamente allo spawn del figlio.
 */
export async function reserveDevRpcPort(): Promise<number> {
	const raw = process.env.SERVER_RPC_PORT?.trim();
	if (raw) {
		const n = Number(raw);
		if (!Number.isNaN(n) && n > 0) return n;
	}
	const p = await pickPort(RPC_START, RPC_SPAN, SERVER_RPC_HOST);
	process.env.SERVER_RPC_PORT = String(p);
	return p;
}
