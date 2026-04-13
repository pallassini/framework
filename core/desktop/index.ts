import { BrowserView, BrowserWindow } from "electrobun/bun";
import { buildElectrobunRequestHandlers, loadDesktopRoutes } from "./routes";
import { writeDesktopRoutesGen } from "./routes/write-client-routes-gen";

const root = process.env.FRAMEWORK_PROJECT_ROOT?.trim() || process.cwd();
writeDesktopRoutesGen(root);
await loadDesktopRoutes(root);

const requests = buildElectrobunRequestHandlers();

const desktopRpc = BrowserView.defineRPC({
	maxRequestTime: 30_000,
	handlers: {
		requests,
	},
});

export const mainWindow = new BrowserWindow({
	title: "App",
	titleBarStyle: "default",
	url: process.env.CLIENT_DEV_SERVER_URL || "views://main/index.html",
	rpc: desktopRpc,
});
