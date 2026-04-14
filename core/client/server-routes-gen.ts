/**
 * Plugin Vite: rigenera `core/client/server/routes-gen.ts` quando cambia `server/routes/**`.
 * Non serve un plugin per le route HTTP del server: il registry carica i file a runtime;
 * questo file serve solo ai **tipi** lato client (`server.ping()`, …).
 */
import { existsSync } from "node:fs";
import { join, normalize } from "node:path";
import type { Plugin, ViteDevServer } from "vite";
import { writeServerRoutesGen } from "../server/routes/generate";
import { isFileUnderDir } from "./is-file-under-dir";

export function genServerRoutes(projectRoot: string): Plugin {
	const rdir = normalize(join(projectRoot, "server", "routes"));
	const regen = () => writeServerRoutesGen(projectRoot);
	return {
		name: "server-routes-gen",
		enforce: "pre",
		buildStart() {
			regen();
		},
		configureServer(server: ViteDevServer) {
			regen();
			if (existsSync(rdir)) server.watcher.add(rdir);
			const onFs = (file: string) => {
				if (!isFileUnderDir(file, rdir) || !/\.(tsx?|jsx?)$/i.test(file)) return;
				regen();
				server.hot.send({ type: "full-reload" });
			};
			server.watcher.on("add", onFs);
			server.watcher.on("change", onFs);
			server.watcher.on("unlink", onFs);
		},
	};
}
