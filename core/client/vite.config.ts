import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Logger, PluginOption } from "vite";
import mkcert from "vite-plugin-mkcert";
import { VitePWA } from "vite-plugin-pwa";
import { createLogger, defineConfig } from "vite-plus";
import { desktopConfig } from "../../desktop/config";
import { SERVER_RPC_HOST, SERVER_RPC_PORT } from "../server/routes/config";
import { genDesktopRoutes } from "./desktop-routes-gen";
import { genFwDbDataWatch } from "./vite-plugin-fwdb-data-watch";
import { genServerRoutes } from "./server-routes-gen";
import { lazyCaseChildrenPlugin } from "./vite-plugin-lazy-case-children";
import { routeAssetSrcPlugin } from "./vite-plugin-route-asset-src";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/**
 * Base URL RPC nel bundle (senza slash finale).
 * - `VITE_SERVER_RPC_ORIGIN` in build (es. Docker `ARG`): `""` = stesso origin del sito (consigliato container unico).
 * - Se non impostata, fallback a `desktop/config.ts` (es. app desktop che punta a un host fisso).
 */
const serverRpcOrigin = (
	process.env.VITE_SERVER_RPC_ORIGIN !== undefined
		? process.env.VITE_SERVER_RPC_ORIGIN
		: (desktopConfig.server?.url ?? "")
)
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
	plugins: [
		lazyCaseChildrenPlugin(root),
		routeAssetSrcPlugin(root),
		genServerRoutes(root),
		genFwDbDataWatch(root),
		genDesktopRoutes(root),
		mkcert(),
		VitePWA({
			registerType: "autoUpdate",
			devOptions: {
				enabled: true,
			},
			includeAssets: ["favicon.png", "pwa-192.png", "pwa-512.png"],
			manifest: {
				name: "Flow",
				short_name: "Flow",
				description: "",
				theme_color: "#0b0f17",
				background_color: "#0b0f17",
				display: "standalone",
				start_url: "./",
				scope: "./",
				icons: [
					{
						src: "pwa-192.png",
						sizes: "192x192",
						type: "image/png",
						purpose: "any maskable",
					},
					{
						src: "pwa-512.png",
						sizes: "512x512",
						type: "image/png",
						purpose: "any maskable",
					},
				],
			},
			workbox: {
				disableDevLogs: true,
				globPatterns: ["**/*.{js,css,html,ico,png,svg,webmanifest}"],
			},
		}),
	] as PluginOption[],
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
