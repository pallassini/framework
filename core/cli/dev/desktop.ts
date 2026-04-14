import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { build } from "vite-plus";
import { desktopConfig } from "../../../desktop/config";

type Proc = ReturnType<typeof Bun.spawn>;

const ANSI_SGR_RE = /\x1b\[[0-9;]*m/g;

function stripAnsi(s: string): string {
	return s.replace(ANSI_SGR_RE, "");
}

/** Solo output del middleware RPC desktop (`logRpcSuccess` / `logRpcError`), non WebView2/Bridge. */
function isDesktopRpcLogLine(line: string): boolean {
	return stripAnsi(line).includes("[desktop]");
}

async function forwardFilteredLines(
	src: ReadableStream<Uint8Array>,
	dest: NodeJS.WriteStream,
): Promise<void> {
	const reader = src.getReader();
	const decoder = new TextDecoder();
	let pending = "";
	try {
		for (;;) {
			const { done, value } = await reader.read();
			if (done) break;
			if (value?.length) pending += decoder.decode(value, { stream: true });
			const parts = pending.split(/\r?\n/);
			pending = parts.pop() ?? "";
			for (const line of parts) {
				if (isDesktopRpcLogLine(line)) dest.write(`${line}\n`);
			}
		}
		pending += decoder.decode();
		if (pending.length && isDesktopRpcLogLine(pending)) {
			dest.write(`${pending}\n`);
		}
	} finally {
		reader.releaseLock();
	}
}

/** Una sessione `electrobun dev` per ogni pressione di `d` (come più terminali). */
const procs = new Set<Proc>();
let busy = false;

function killProc(p: Proc): void {
	try {
		if (process.platform === "win32") {
			spawnSync("taskkill", ["/PID", String(p.pid), "/T", "/F"], {
				stdio: "ignore",
				windowsHide: true,
			});
		} else {
			p.kill(9);
		}
	} catch {
		try {
			p.kill(9);
		} catch {
			/* */
		}
	}
}

export async function startDesktop(root: string, url: string): Promise<void> {
	if (busy) return;
	busy = true;
	try {
		const webDir = path.join(root, "build/web");
		const indexHtml = path.join(webDir, "index.html");
		const assetsDir = path.join(webDir, "assets");
		if (!existsSync(indexHtml) || !existsSync(assetsDir)) {
			await build({ configFile: path.join(root, "core/client/vite.config.ts") });
			if (!existsSync(assetsDir)) mkdirSync(assetsDir, { recursive: true });
		}
		const spawnLog = desktopConfig.log.devDesktopSpawnLog !== false;
		const loud = desktopConfig.log.electrbunDevOutput !== false;
		const logRpc = desktopConfig.log.enabled;
		let stdin: "inherit" | "ignore";
		let stdout: "inherit" | "ignore" | "pipe";
		let stderr: "inherit" | "ignore" | "pipe";
		if (loud) {
			stdin = "inherit";
			stdout = "inherit";
			stderr = "inherit";
		} else if (!logRpc) {
			stdin = "ignore";
			stdout = "ignore";
			stderr = "ignore";
		} else {
			stdin = "inherit";
			stdout = "pipe";
			stderr = "pipe";
		}
		const instanceId = randomUUID();
		const proc = Bun.spawn({
			cmd: ["bun", "x", "electrobun", "dev", "--watch"],
			cwd: root,
			stdin,
			stdout,
			stderr,
			env: {
				...process.env,
				CLIENT_DEV_SERVER_URL: url,
				FRAMEWORK_PROJECT_ROOT: root,
				FRAMEWORK_DESKTOP_OUT: "dev",
				FRAMEWORK_DESKTOP_DEV_INSTANCE: instanceId,
			},
		});
		procs.add(proc);
		if (stdout === "pipe" && stderr === "pipe") {
			void (async () => {
				try {
					await Promise.all([
						forwardFilteredLines(proc.stdout!, process.stdout),
						forwardFilteredLines(proc.stderr!, process.stderr),
					]);
				} catch {
					/* stream chiuso o processo terminato */
				}
			})();
		}
		void proc.exited.then(() => {
			procs.delete(proc);
			if (spawnLog) {
				console.log(`[d] electrbun dev terminato (pid ${proc.pid}, session ${instanceId.slice(0, 8)}…)`);
			}
		});
		if (spawnLog) {
			console.log(
				`[d] electrbun dev · spawn #${procs.size} · wrapper pid ${proc.pid} · session ${instanceId.slice(0, 8)}… — spesso una sola finestra per app (identifier electrobun.config); più UI = altro BrowserWindow nello stesso processo.`,
			);
		}
	} catch (e) {
		console.error(e);
	} finally {
		busy = false;
	}
}

export function killDesktop(): void {
	for (const p of procs) {
		killProc(p);
	}
	procs.clear();
}

/** True se è in esecuzione almeno un `electrobun dev` spawnato da questo CLI (tasto d). */
export function isDesktopDevRunning(): boolean {
	return procs.size > 0;
}
