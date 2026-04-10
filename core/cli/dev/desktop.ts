import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { build } from "vite-plus";

let child: ReturnType<typeof Bun.spawn> | undefined;
let busy = false;

export async function startDesktop(root: string, url: string): Promise<void> {
	if (child || busy) return;
	busy = true;
	try {

		// BUILD WEB (if not already built)
		const indexHtml = path.join(root, "build/web/index.html");
		const assetsDir = path.join(root, "build/web/assets");
		if (!existsSync(indexHtml) || !existsSync(assetsDir)) {
			await build({
				configFile: path.join(root, "core/client/vite.config.ts"),
			});
			if (!existsSync(assetsDir)) mkdirSync(assetsDir, { recursive: true });
		}

		// START DESKTOP
		child = Bun.spawn({
			cmd: ["bun", "x", "electrobun", "dev", "--watch"],
			cwd: root,
			stdin: "inherit",
			stdout: "inherit",
			stderr: "inherit",
			env: { ...process.env, CLIENT_DEV_SERVER_URL: url },
		});
		void child.exited.then(() => {
			child = undefined;
		});
	} catch (e) {
		console.error(e);
	} finally {
		busy = false;
	}
}

export function killDesktop(): void {
	const c = child;
	if (!c) return;
	child = undefined;
	try {
		if (process.platform === "win32") {
			spawnSync("taskkill", ["/PID", String(c.pid), "/T", "/F"], {
				stdio: "ignore",
				windowsHide: true,
			});
		} else {
			c.kill(9);
		}
	} catch {
		try {
			c.kill(9);
		} catch {}
	}
}
