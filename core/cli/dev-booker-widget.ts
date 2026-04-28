/**
 * `bun dev:build`: stesso flusso di `bun dev` + `vite build --watch` su `booker.js` → `public/booker.js`.
 * Dopo ogni modifica a `routes/booker/index.tsx` ricompila; ricarica la pagina per vedere lo script aggiornato.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const bookerCfg = path.join(root, "core", "client", "vite.booker.config.ts");
const devEntry = path.join(root, "core", "cli", "dev", "index.ts");

function killChildTree(child: ReturnType<typeof Bun.spawn>): void {
	const pid = child.pid;
	if (pid == null) return;
	try {
		if (process.platform === "win32") {
			spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
		} else {
			child.kill(9);
		}
	} catch {
		/* */
	}
}

const watchChild = Bun.spawn({
	cmd: ["bun", "x", "vite", "build", "--watch", "-c", bookerCfg],
	cwd: root,
	stdin: "ignore",
	stdout: "inherit",
	stderr: "inherit",
	env: { ...process.env, FRAMEWORK_PROJECT_ROOT: root },
});

const devChild = Bun.spawn({
	cmd: ["bun", devEntry],
	cwd: root,
	stdin: "inherit",
	stdout: "inherit",
	stderr: "inherit",
	env: { ...process.env, FRAMEWORK_PROJECT_ROOT: root },
});

const stop = () => {
	killChildTree(watchChild);
	killChildTree(devChild);
	process.exit(0);
};

for (const s of ["SIGINT", "SIGTERM", "SIGHUP", ...(process.platform === "win32" ? (["SIGBREAK"] as const) : [])] as const) {
	process.on(s, stop);
}

await devChild.exited;
stop();
