import path from "node:path";
import { fileURLToPath } from "node:url";
import type { PluginOption } from "vite";
import mkcert from "vite-plugin-mkcert";
import { defineConfig } from "vite-plus";
import { SERVER_RPC_HOST, SERVER_RPC_PORT } from "../server/routes/config";
import { genServerRoutes } from "./server-routes-gen";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export default defineConfig({
	root: root,
	base: "./",
	logLevel: "warn",
	plugins: [genServerRoutes(root), mkcert()] as PluginOption[],
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
	resolve: { tsconfigPaths: true },
});
