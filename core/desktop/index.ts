import { BrowserView, BrowserWindow } from "electrobun/bun";
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
}
