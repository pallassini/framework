import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite-plus";
import { desktopConfig } from "../../desktop/config";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** Allineato a `vite.config.ts`: alias `client`, define RPC. */
const serverRpcOrigin = (
	process.env.VITE_SERVER_RPC_ORIGIN !== undefined
		? process.env.VITE_SERVER_RPC_ORIGIN
		: (desktopConfig.server?.url ?? "")
)
	.trim()
	.replace(/\/$/, "");

/** Bundle IIFE → `public/booker.js` — sorgente: `client/routes/booker/index.tsx` via `embed-entry.ts`. */
export default defineConfig({
	root,
	publicDir: false,
	plugins: [],
	build: {
		emptyOutDir: false,
		lib: {
			entry: path.join(root, "client/booker/embed-entry.ts"),
			name: "BookerEmbed",
			formats: ["iife"],
			fileName: () => "booker.js",
		},
		outDir: path.join(root, "public"),
	},
	define: {
		"import.meta.env.VITE_SERVER_RPC_ORIGIN": JSON.stringify(serverRpcOrigin),
	},
	resolve: { tsconfigPaths: true },
}) as Parameters<typeof defineConfig>[0];
