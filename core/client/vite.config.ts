import { defineConfig } from "vite-plus";
import basicSsl from "@vitejs/plugin-basic-ssl";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export default defineConfig({
	root: root,
	base: "./",
	plugins: [basicSsl()],
	resolve: {
		tsconfigPaths: true,
	},
});
