/**
 * Avvio processo RPC (`bun core/server/routes/serve.ts`) in parallelo a Vite.
 * Vite fa proxy di `/_server` → `core/server/routes/config.ts`.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { serverConfig } from "../../server/routes/config";

let child: ReturnType<typeof Bun.spawn> | undefined;

/** Attende che Bun.serve sia in ascolto (qualsiasi risposta HTTP, es. 404 sulla root). */
async function waitForRpcListen(baseUrl: string): Promise<void> {
	for (let i = 0; i < 200; i++) {
		try {
			const r = await fetch(baseUrl, { method: "GET" });
			r.body?.cancel().catch(() => {});
			return;
		} catch {
			/* connessione rifiutata / server non ancora su */
		}
		await Bun.sleep(25);
	}
	throw new Error(`RPC non risponde su ${baseUrl}`);
}

export async function startRpcServer(projectRoot: string): Promise<void> {
	if (child) return;

	const entry = path.join(projectRoot, "core", "server", "routes", "serve.ts");
	child = Bun.spawn({
		cmd: ["bun", entry],
		cwd: projectRoot,
		stdin: "inherit",
		stdout: "inherit",
		stderr: "inherit",
		env: { ...process.env, FRAMEWORK_PROJECT_ROOT: projectRoot },
	});

	const base = `http://${serverConfig.host}:${serverConfig.port}/`;
	await Promise.race([
		waitForRpcListen(base),
		child.exited.then((code) => {
			throw new Error(`RPC processo terminato (${code ?? "n/d"})`);
		}),
	]);
}

export function killRpcServer(): void {
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
