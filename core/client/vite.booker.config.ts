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

/** Bundle IIFE → `public/booker.js`; stesso modulo della route con `VITE_BOOKER_EMBED`. */
export default defineConfig({
	root,
	publicDir: false,
	plugins: [],
	build: {
		emptyOutDir: false,
		lib: {
			entry: path.join(root, "client/routes/booker/index.tsx"),
			name: "BookerEmbed",
			formats: ["iife"],
			fileName: () => "booker.js",
		},
		outDir: path.join(root, "public"),
	},
	define: {
		"import.meta.env.VITE_SERVER_RPC_ORIGIN": JSON.stringify(serverRpcOrigin),
		"import.meta.env.VITE_BOOKER_EMBED": JSON.stringify(true),
	},
	resolve: { tsconfigPaths: true },
}) as Parameters<typeof defineConfig>[0];
