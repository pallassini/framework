import path from "node:path";
import { fileURLToPath } from "node:url";
import mkcert from "vite-plugin-mkcert";
import { defineConfig } from "vite-plus";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");


export default defineConfig({
	root: root,
	base: "./",
	logLevel: "warn",
	plugins: [mkcert()],
	lint: {
		ignorePatterns: ["build/**", "node_modules/**"],
	},
	fmt: {},
	server: {
		host: true,
	},
	build: {
		outDir: "build/web",
		emptyOutDir: true,
	},
	resolve: { tsconfigPaths: true },
});
