import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Logger, Plugin, PluginOption } from "vite";
import mkcert from "vite-plugin-mkcert";
import { createLogger, defineConfig } from "vite-plus";
import { desktopConfig } from "../../desktop/config";
import { getServerRpcPort, SERVER_RPC_HOST } from "../server/routes/config";
import { genDesktopRoutes } from "./desktop-routes-gen";
import { genFwDbDataWatch } from "./vite-plugin-fwdb-data-watch";
import { genServerRoutes } from "./server-routes-gen";
import { lazyCaseChildrenPlugin } from "./vite-plugin-lazy-case-children";
import { routeAssetSrcPlugin } from "./vite-plugin-route-asset-src";
import { swPushPlugin } from "./vite-plugin-sw-push";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function fwDevProbePlugin(token: string): Plugin {
	return {
		name: "fw-dev-probe",
		configureServer(server) {
			server.middlewares.use((req, res, next) => {
				const u = req.url?.split("#")[0] ?? "";
				if (!u.startsWith("/__fw_dev_probe")) {
					next();
					return;
				}
				const q = u.includes("?") ? u.slice(u.indexOf("?") + 1) : "";
				const t = new URLSearchParams(q).get("t");
				if (t === token) {
					res.statusCode = 200;
					res.setHeader("Content-Type", "text/plain");
					res.end("ok");
					return;
				}
				/** Altrimenti `next()` darebbe 200 dal fallback SPA → falso “probe OK” su un altro `bun dev`. */
				res.statusCode = 404;
				res.setHeader("Content-Type", "text/plain");
				res.end("probe mismatch");
				return;
			});
		},
	};
}

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

export default defineConfig(
	(() => {
		const frameworkVitePort = process.env.FRAMEWORK_VITE_PORT?.trim();
		const devServerPort =
			frameworkVitePort !== undefined && frameworkVitePort !== "" && !Number.isNaN(Number(frameworkVitePort))
				? Number(frameworkVitePort)
				: undefined;
		const viteDevProbe = process.env.FRAMEWORK_VITE_PROBE?.trim();

		const out = {
			root: root,
			base: "./",
			logLevel: "silent",
			customLogger: muteIssueLogger(),
			plugins: [
				...(viteDevProbe ? [fwDevProbePlugin(viteDevProbe)] : []),
				swPushPlugin(root),
				lazyCaseChildrenPlugin(root),
				routeAssetSrcPlugin(root),
				genServerRoutes(root),
				genFwDbDataWatch(root),
				genDesktopRoutes(root),
				mkcert(),
			] as PluginOption[],
			lint: {
				ignorePatterns: ["build/**", "node_modules/**"],
			},
			fmt: {},
			server: {
				host: true,
				...(devServerPort !== undefined ? { port: devServerPort, strictPort: true } : {}),
				proxy: {
					"/_server": {
						target: `http://${SERVER_RPC_HOST}:${getServerRpcPort()}`,
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
				"import.meta.env.VITE_BOOKER_EMBED": JSON.stringify(false),
			},
			resolve: { tsconfigPaths: true },
		};
		return out;
		// vite-plus config è più ampia di `vite.UserConfig` (lint/fmt): evita ricorsione di tipo su defineConfig.
	})() as Parameters<typeof defineConfig>[0],
);
