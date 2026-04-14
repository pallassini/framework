import { existsSync, mkdirSync, statSync, watch } from "node:fs";
import { join } from "node:path";
import { BrowserView, BrowserWindow } from "electrobun/bun";
import { setDbDevSchemaReloadNotifier } from "../db";
import { FW_DB_SCHEMA_RELOAD_EVENT } from "../fw-db-schema-reload-event";
import { scheduleDevDbSchemaFanoutFromDesktop } from "../db/dev-schema-watch";
import { registerOpenDesktopWebWindow, setupDevDesktopExtraWindowSignal } from "./dev-windows";
import { loadBundledDesktopRoutes } from "./routes/bundled.generated";
import { buildElectrobunRequestHandlers, loadDesktopRoutes } from "./routes";
import { watchDesktopRoutes } from "./routes/watch";
import { writeDesktopRoutesGen } from "./routes/write-client-routes-gen";

/**
 * Dev da repo: Vite + `electrodun dev` impostano queste env. App installata: nessuna → route da bundle.
 * (Evita `writeDesktopRoutesGen` su cwd tipo Desktop che fa crashare prima della finestra.)
 */
const devFromRepo = Boolean(
	process.env.CLIENT_DEV_SERVER_URL?.trim() || process.env.FRAMEWORK_PROJECT_ROOT?.trim(),
);
const root = process.env.FRAMEWORK_PROJECT_ROOT?.trim() || process.cwd();

setDbDevSchemaReloadNotifier(() => {
	const views = BrowserView.getAll();
	/** Pagina Vite: esecuzione diretta nel frame principale. */
	const js = `window.dispatchEvent(new CustomEvent(${JSON.stringify(FW_DB_SCHEMA_RELOAD_EVENT)}))`;
	/** Fallback: stesso canale degli altri messaggi main→webview (socket / preload). */
	const rpcPacket = {
		type: "message" as const,
		id: "fwDbSchemaReloaded",
		payload: null,
	};
	// Una riga con [desktop] così passa il filtro in `core/cli/dev/desktop.ts` quando electrodun è in pipe.
	console.log(
		`[desktop] db-schema→webview n=${views.length} ids=[${views.map((v) => v.id).join(",")}] event=${FW_DB_SCHEMA_RELOAD_EVENT} (executeJs; rpc solo se executeJs fallisce)`,
	);
	for (const view of views) {
		try {
			view.executeJavascript(js);
		} catch (e) {
			console.error(`[desktop] db-schema webview ${view.id} executeJavascript:`, e);
			try {
				view.sendMessageToWebviewViaExecute(rpcPacket);
			} catch (e2) {
				console.error(`[desktop] db-schema webview ${view.id} sendMessageToWebviewViaExecute:`, e2);
			}
		}
	}
});

/**
 * Il processo RPC (`bun dev`) spesso è il solo a ricevere fs.watch su `db/`; dopo reload scrive
 * `core/desktop/.dev/db-schema-reload`. Qui rifacciamo reload + notifier nell’Electrodun.
 */
function setupDevDbSchemaFanoutWatcher(projectRoot: string): void {
	if (process.env.NODE_ENV === "production") return;
	if (process.env.FWDB_DEV_SCHEMA_WATCH?.trim() === "0") return;

	const dir = join(projectRoot, "core", "desktop", ".dev");
	const tokenFile = join(dir, "db-schema-reload");
	mkdirSync(dir, { recursive: true });
	let lastTokenMtimeMs = existsSync(tokenFile) ? statSync(tokenFile).mtimeMs : 0;
	let debounce: ReturnType<typeof setTimeout> | undefined;
	try {
		watch(dir, { persistent: true }, () => {
			if (!existsSync(tokenFile)) return;
			const m = statSync(tokenFile).mtimeMs;
			if (m === lastTokenMtimeMs) return;
			lastTokenMtimeMs = m;
			if (debounce != null) clearTimeout(debounce);
			debounce = setTimeout(() => {
				debounce = undefined;
				console.log("[desktop] db-schema fanout: reload Electrodun dopo segnale da processo RPC");
				scheduleDevDbSchemaFanoutFromDesktop();
			}, 400);
		});
	} catch {
		/* */
	}
}

if (devFromRepo) {
	writeDesktopRoutesGen(root);
	await loadDesktopRoutes(root);
	watchDesktopRoutes(root);
} else {
	await loadBundledDesktopRoutes();
}

const requests = buildElectrobunRequestHandlers();

const desktopRpc = BrowserView.defineRPC({
	maxRequestTime: 30_000,
	handlers: {
		requests,
	},
});

function clientSurfaceUrl(path: string): string {
	const dev = process.env.CLIENT_DEV_SERVER_URL?.trim();
	const p = path.startsWith("/") ? path : `/${path}`;
	if (dev) return `${dev.replace(/\/$/, "")}${p}`;
	return "views://main/index.html";
}

registerOpenDesktopWebWindow((path) => {
	new BrowserWindow({
		title: "App",
		titleBarStyle: "default",
		url: clientSurfaceUrl(path),
		rpc: desktopRpc,
	});
});

export const mainWindow = new BrowserWindow({
	title: "App",
	titleBarStyle: "default",
	url: process.env.CLIENT_DEV_SERVER_URL || "views://main/index.html",
	rpc: desktopRpc,
});

if (devFromRepo) {
	setupDevDesktopExtraWindowSignal(root);
	setupDevDbSchemaFanoutWatcher(root);
}
