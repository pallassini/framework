import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Logger, PluginOption } from "vite";
import mkcert from "vite-plugin-mkcert";
import { createLogger, defineConfig } from "vite-plus";
import { desktopConfig } from "../../desktop/config";
import { SERVER_RPC_HOST, SERVER_RPC_PORT } from "../server/routes/config";
import { genDesktopRoutes } from "./desktop-routes-gen";
import { genServerRoutes } from "./server-routes-gen";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/**
 * Base URL per `fetch` RPC in prod (`/_server/...`).
 * Override build: `VITE_SERVER_RPC_ORIGIN=https://api.example.com bun run build`
 * (utile se il sito statico è su un host e l’API su un altro).
 */
const serverRpcOrigin = (process.env.VITE_SERVER_RPC_ORIGIN ?? desktopConfig.server?.url ?? "")
	.trim()
	.replace(/\/$/, "");

/** Dev: nessun `error` / `warn` Vite in terminale (import-analysis, oxc, HMR, ecc.). */
function muteIssueLogger(): Logger {
	const base = createLogger("silent");
	return {
		...base,
		error() {
			/* silenzioso */
		},
		warn() {
			/* silenzioso */
		},
		warnOnce() {
			/* silenzioso */
		},
	};
}

export default defineConfig({
	root: root,
	base: "./",
	logLevel: "silent",
	customLogger: muteIssueLogger(),
	plugins: [genServerRoutes(root), genDesktopRoutes(root), mkcert()] as PluginOption[],
	lint: {
		ignorePatterns: ["build/**", "node_modules/**"],
	},
	fmt: {},
	server: {
		host: true,
		proxy: {
			"/_server": {
				target: `http://${SERVER_RPC_HOST}:${SERVER_RPC_PORT}`,
				changeOrigin: true,
			},
		},
	},
	build: {
		outDir: "build/web",
		emptyOutDir: true,
	},
	define: {
		"import.meta.env.VITE_SERVER_RPC_ORIGIN": JSON.stringify(serverRpcOrigin),
	},
	resolve: { tsconfigPaths: true },
});
