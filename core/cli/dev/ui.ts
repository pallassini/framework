import { networkInterfaces } from "node:os";

const R = "\x1b[0m";
const M = "\x1b[38;2;255;0;135m";
const B = "\x1b[1;38;2;255;0;135m";
const W = 40;
const P = 2;

const strip = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, "");
const fill = (s: string, n: number) => s + " ".repeat(Math.max(0, n - strip(s).length));
const row = (t: string) => M + "\u2502" + R + " ".repeat(P) + fill(t, W - P) + M + "\u2502" + R;

const isV4 = (f: string | number) => f === "IPv4" || f === 4;

/** URL LAN: Vite, altrimenti prima IPv4 non interna + porta da `local`. */
export function resolveLan(local: string, fromVite?: string): string {
	if (fromVite) return fromVite;
	const u = new URL(local);
	const port = u.port || (u.protocol === "https:" ? "443" : "80");
	const proto = `${u.protocol}//`;
	for (const list of Object.values(networkInterfaces() ?? {})) {
		if (!list) continue;
		for (const i of list) {
			if (isV4(i.family) && !i.internal) return `${proto}${i.address}:${port}/`;
		}
	}
	return `${proto}127.0.0.1:${port}/`;
}

export function clientUI(local: string, lan: string): void {
	const title = " " + B + "dev" + R + " ";
	const tw = strip(title).length;
	const L = Math.floor((W - tw) / 2);
	const top = M + "\u256d" + "\u2500".repeat(L) + title + M + "\u2500".repeat(W - L - tw) + "\u256e" + R;
	const blank = M + "\u2502" + R + " ".repeat(W) + M + "\u2502" + R;
	const d = M + "\u25c6" + R;
	process.stdout.write(
		"\n" +
			top +
			"\n" +
			blank +
			"\n" +
			row(`${d} local  ${M}${local}${R}`) +
			"\n" +
			row(`${d} lan    ${M}${lan}${R}`) +
			"\n" +
			blank +
			"\n" +
			M +
			"\u2570" +
			"\u2500".repeat(W) +
			"\u256f" +
			R +
			"\n\n",
	);
}
