import basicSsl from "@vitejs/plugin-basic-ssl";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";
import { defineConfig } from "vite-plus";
import { clientUI, resolveLan } from "../cli/dev/ui";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function devClientUIPlugin(): Plugin {
	return {
		name: "dev-client-ui",
		configureServer(server) {
			server.printUrls = () => {
				const u = server.resolvedUrls;
				const local = u?.local[0] ?? "https://localhost:3000/";
				clientUI(local, resolveLan(local, u?.network[0]));
			};
		},
	};
}

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
	plugins: [basicSsl(), devClientUIPlugin()],
	resolve: {
		tsconfigPaths: true,
	},
});
