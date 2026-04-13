import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { build } from "vite-plus";
import { desktopConfig } from "../../../desktop/config";

type Proc = ReturnType<typeof Bun.spawn>;

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
		const noisy = desktopConfig.log.electrbunDevOutput !== false;
		const spawnLog = desktopConfig.log.devDesktopSpawnLog !== false;
		const io = noisy ? ("inherit" as const) : ("ignore" as const);
		const instanceId = randomUUID();
		const proc = Bun.spawn({
			cmd: ["bun", "x", "electrobun", "dev", "--watch"],
			cwd: root,
			stdin: io,
			stdout: io,
			stderr: io,
			env: {
				...process.env,
				CLIENT_DEV_SERVER_URL: url,
				FRAMEWORK_PROJECT_ROOT: root,
				FRAMEWORK_DESKTOP_DEV_INSTANCE: instanceId,
			},
		});
		procs.add(proc);
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
