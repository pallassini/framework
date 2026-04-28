import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { networkInterfaces } from "node:os";
import path from "node:path";
import { pickViteDevPort } from "./ports";

const PORT_START = 3000;
const PORT_SPAN = 200;

let child: ReturnType<typeof Bun.spawn> | undefined;

export function killViteProc(): void {
	const c = child;
	if (!c) return;
	child = undefined;
	try {
		if (process.platform === "win32") {
			spawnSync("taskkill", ["/PID", String(c.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
		} else {
			c.kill(9);
		}
	} catch {
		try {
			c.kill(9);
		} catch {
			/* */
		}
	}
}

async function waitVpUrl(url: string): Promise<void> {
	for (let i = 0; i < 250; i++) {
		try {
			if ((await fetch(url, { tls: { rejectUnauthorized: false } })).ok) return;
		} catch {
			/* */
		}
		await Bun.sleep(40);
	}
	throw new Error("vp dev non risponde");
}

export async function startClient(root: string): Promise<{ client: ViteClient }> {
	const cfg = path.join(root, "core/client/vite.config.ts");
	const port = await pickViteDevPort(PORT_START, PORT_SPAN);
	const probeToken = randomUUID();
	const probePath = `/__fw_dev_probe?t=${encodeURIComponent(probeToken)}`;
	child = Bun.spawn({
		cmd: ["bun", "x", "vp", "dev", "--port", String(port), "--strictPort", "-c", cfg],
		cwd: root,
		env: {
			...process.env,
			FRAMEWORK_VITE_PORT: String(port),
			FRAMEWORK_VITE_PROBE: probeToken,
		},
		stdout: "inherit",
		stderr: "inherit",
	});
	const c = child;
	const probe = `https://127.0.0.1:${port}${probePath}`;
	await Promise.race([
		waitVpUrl(probe),
		c.exited.then((code) => {
			throw new Error(`vp dev (${code ?? "n/d"})`);
		}),
	]);

	const url = `https://localhost:${port}/`;
	const cl: ViteClient = {
		url,
		port,
		network: lan(url),
		close: async () => {
			killViteProc();
		},
	};
	box(cl);
	return { client: cl };
}

//_______________________________________________________________________________________________________________
//UTILS
export type ViteClient = { url: string; port: number; network: string; close: () => Promise<void> };

function lan(base: string): string {
	const u = new URL(base);
	for (const list of Object.values(networkInterfaces() ?? {})) {
		if (!list) continue;
		for (const i of list) {
			if (i.family === "IPv4" && !i.internal) return `https://${i.address}:${u.port}/`;
		}
	}
	return base;
}

const R = "\x1b[0m",
	M = "\x1b[38;2;255;0;135m",
	B = "\x1b[1;38;2;255;0;135m",
	W = 40,
	P = 2;
const ANSI_RE = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g");
const strip = (s: string) => s.replace(ANSI_RE, "");
const fill = (s: string, n: number) => s + " ".repeat(Math.max(0, n - strip(s).length));
const row = (t: string) => M + "\u2502" + R + " ".repeat(P) + fill(t, W - P) + M + "\u2502" + R;

function box(c: ViteClient): void {
	const d = M + "\u25c6" + R,
		title = " " + B + "dev" + R + " ",
		tw = strip(title).length,
		L = Math.floor((W - tw) / 2),
		top = M + "\u256d" + "\u2500".repeat(L) + title + M + "\u2500".repeat(W - L - tw) + "\u256e" + R,
		blank = M + "\u2502" + R + " ".repeat(W) + M + "\u2502" + R;
	process.stdout.write(
		`\n${top}\n${blank}\n${row(`${d} local  ${M}${c.url}${R}`)}\n${row(`${d} lan    ${M}${c.network}${R}`)}\n${blank}\n` +
			M +
			"\u2570" +
			"\u2500".repeat(W) +
			"\u256f" +
			R +
			`\n ${B}[d]${R} Desktop  ·  ${B}[e]${R} Editor\n\n`,
	);
}
