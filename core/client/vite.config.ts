import path from "node:path";
import { fileURLToPath } from "node:url";
import mkcert from "vite-plugin-mkcert";
import { defineConfig } from "vite-plus";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** `mkcert` abilita HTTPS; **no** `server.https: {}` (si sovrappone a mkcert → spesso pagina in chiaro ma HMR resta `wss` e il socket fallisce). */
export default defineConfig({
	root: root,
	base: "./",
	logLevel: "warn",
	plugins: [mkcert()],
	server: {
		host: true,
		port: 3000,
		strictPort: false,
		hmr: { protocol: "wss" },
	},
	build: {
		outDir: "build/web",
		emptyOutDir: true,
	},
	resolve: {
		tsconfigPaths: true,
	},
});
