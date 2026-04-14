import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";
import { writeDesktopBundledLoad } from "../../desktop/routes/write-bundled-load";
import { writeDesktopRoutesGen } from "../../desktop/routes/write-client-routes-gen";
import { writeServerRoutesGen } from "../../server/routes/generate";
import { killViteProc, startClient } from "./client";
import { isDesktopDevRunning, killDesktop, startDesktop } from "./desktop";
import { killRpcServer, startRpcServer } from "./server";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

// —— BUILD (opzionale: `FRAMEWORK_BUILD_BEFORE_DEV=web|desktop|all`)
const prebuild = process.env.FRAMEWORK_BUILD_BEFORE_DEV?.trim().toLowerCase();
if (prebuild === "web" || prebuild === "desktop" || prebuild === "all" || prebuild === "server") {
	const arg = prebuild === "server" ? "web" : prebuild;
	const buildEntry = path.join(root, "core", "cli", "build", "index.ts");
	const r = Bun.spawnSync(["bun", buildEntry, arg], {
		cwd: root,
		stdout: "inherit",
		stderr: "inherit",
		stdin: "inherit",
		env: { ...process.env, FRAMEWORK_PROJECT_ROOT: root },
	});
	if (r.exitCode !== 0) process.exit(r.exitCode ?? 1);
}

// Rigenera stub route (allineati al disco anche se il watch non ha ancora girato)
writeServerRoutesGen(root);
writeDesktopRoutesGen(root);
writeDesktopBundledLoad(root);

// —— cleanup su exit del processo dev ——
process.on("exit", () => {
	killViteProc();
	killRpcServer();
	killDesktop();
});

// —— SERVER
try {
	await startRpcServer(root);
} catch (e) {
	console.error("[dev] RPC server non avviato:", e);
	process.exit(1);
}

// —— CLIENT (Vite / editor)
let client: Awaited<ReturnType<typeof startClient>>["client"];
try {
	({ client } = await startClient(root));
} catch (e) {
	console.error("[dev] dev server web (Vite) non avviato:", e);
	process.exit(1);
}

// —— STOP
const stop = async () => {
	killDesktop();
	killRpcServer();
	await client.close().catch(() => {});
	process.exit(0);
};

// —— OS error → STOP
for (const s of [
	"SIGINT",
	"SIGTERM",
	"SIGHUP",
	...(process.platform === "win32" ? ["SIGBREAK"] : []),
] as const) {
	process.on(s, () => void stop());
}

// Ctrl+C → STOP
// d → DESKTOP (Electrobun)
if (process.stdin.isTTY) {
	readline.emitKeypressEvents(process.stdin);
	process.stdin.setRawMode(true);
	process.stdin.on("keypress", (ch, k) => {
		if (k?.ctrl && k?.name === "c") void stop();
		else if (ch === "d" || ch === "D") {
			void startDesktop(root, client.url).catch((e) => console.error("[dev] desktop (d):", e));
		} else if (ch === "e" || ch === "E") {
			void (async () => {
				try {
					if (!isDesktopDevRunning()) {
						await startDesktop(root, client.url);
					}
					const dir = path.join(root, "core", "desktop", ".dev");
					mkdirSync(dir, { recursive: true });
					writeFileSync(path.join(dir, "open-webview"), "/_devtools\n", "utf8");
				} catch (e) {
					console.error("[dev] editor (e):", e);
				}
			})();
		}
	});
}

/** CI / agent: `FRAMEWORK_DEV_AUTO_DESKTOP=1` avvia Electrodun (come `d`) e apre `/_devtools/db` (scheda DB). */
if (process.env.FRAMEWORK_DEV_AUTO_DESKTOP?.trim() === "1") {
	void (async () => {
		await Bun.sleep(2000);
		try {
			if (!isDesktopDevRunning()) {
				await startDesktop(root, client.url);
			}
			const dir = path.join(root, "core", "desktop", ".dev");
			mkdirSync(dir, { recursive: true });
			writeFileSync(path.join(dir, "open-webview"), "/_devtools/db\n", "utf8");
			console.log(
				"[dev] FRAMEWORK_DEV_AUTO_DESKTOP=1 → electrodun (se necessario) + open-webview /_devtools/db",
			);
		} catch (e) {
			console.error("[dev] FRAMEWORK_DEV_AUTO_DESKTOP:", e);
		}
	})();
}
