import basicSsl from "@vitejs/plugin-basic-ssl";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite-plus";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export default defineConfig({
	root: root,
	base: "./",
	logLevel: "warn",
	server: {
		host: true,
		port: 3000,
		strictPort: false,
		https: {},
		hmr: { protocol: "wss" },
	},
	build: {
		outDir: "build/web",
		emptyOutDir: true,
	},
	plugins: [basicSsl()],
	resolve: {
		tsconfigPaths: true,
	},
});
