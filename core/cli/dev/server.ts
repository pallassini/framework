/**
 * Avvio processo RPC (`bun core/server/routes/serve.ts`) in parallelo a Vite.
 * Vite fa proxy di `/_server` → `core/server/routes/config.ts`.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { serverConfig } from "../../server/routes/config";

let child: ReturnType<typeof Bun.spawn> | undefined;

function isGpaLeakLine(line: string): boolean {
	return (
		line.includes("error(gpa):") ||
		line.includes("(fwdb.dll)") ||
		line.includes("(libfwdb.so)") ||
		line.includes("(libfwdb.dylib)")
	);
}

function isLeakStackFrameLine(line: string): boolean {
	const t = line.trim();
	return (
		t.length === 0 ||
		t.startsWith("???:?:?:") ||
		t.includes("(bun.exe)") ||
		t.includes("(???)")
	);
}

async function forwardRpcOutput(
	src: ReadableStream<Uint8Array>,
	dest: NodeJS.WriteStream,
	suppressGpaLeakLogs: boolean,
): Promise<void> {
	const reader = src.getReader();
	const decoder = new TextDecoder();
	let pending = "";
	let inLeakStackBlock = false;
	try {
		for (;;) {
			const { done, value } = await reader.read();
			if (done) break;
			if (value?.length) pending += decoder.decode(value, { stream: true });
			const parts = pending.split(/\r?\n/);
			pending = parts.pop() ?? "";
			for (const line of parts) {
				if (suppressGpaLeakLogs) {
					if (isGpaLeakLine(line)) {
						inLeakStackBlock = true;
						continue;
					}
					if (inLeakStackBlock) {
						if (isLeakStackFrameLine(line)) continue;
						inLeakStackBlock = false;
					}
				}
				dest.write(`${line}\n`);
			}
		}
		pending += decoder.decode();
		if (suppressGpaLeakLogs && isGpaLeakLine(pending)) {
			inLeakStackBlock = true;
			pending = "";
		}
		if (pending.length > 0) {
			if (suppressGpaLeakLogs && inLeakStackBlock && isLeakStackFrameLine(pending)) {
				/* */
			} else {
			dest.write(`${pending}\n`);
			}
		}
	} finally {
		reader.releaseLock();
	}
}

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

export async function startRpcServer(projectRoot: string, rpcPort: number): Promise<void> {
	if (child) return;

	const entry = path.join(projectRoot, "core", "server", "routes", "serve.ts");
	const suppressGpaLeakLogs = process.env.FWDB_SUPPRESS_GPA_LOGS?.trim() !== "0";
	child = Bun.spawn({
		cmd: ["bun", entry],
		cwd: projectRoot,
		stdin: "inherit",
		stdout: "pipe",
		stderr: "pipe",
		env: {
			...process.env,
			FRAMEWORK_PROJECT_ROOT: projectRoot,
			SERVER_RPC_PORT: String(rpcPort),
			/** Solo questo processo deve toccare `db-schema-reload` dopo reload schema (evita ping-pong con Electrodun). */
			FWDB_DEV_RPC_CHILD: "1",
		},
	});
	if (child.stdout && child.stderr) {
		void Promise.all([
			forwardRpcOutput(child.stdout, process.stdout, suppressGpaLeakLogs),
			forwardRpcOutput(child.stderr, process.stderr, suppressGpaLeakLogs),
		]).catch(() => {
			/* stream chiuso o processo terminato */
		});
	}

	const base = `http://${serverConfig.host}:${rpcPort}/`;
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
