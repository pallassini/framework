/**
 * Plugin Vite: rigenera `core/client/server/routes-gen.ts` quando cambia `server/routes/**`.
 * Non serve un plugin per le route HTTP del server: il registry carica i file a runtime;
 * questo file serve solo ai **tipi** lato client (`server.ping()`, …).
 */
import { existsSync } from "node:fs";
import { join, normalize } from "node:path";
import type { ViteDevServer } from "vite";
import { writeServerRoutesGen } from "../server/routes/generate";

export function genServerRoutesPlugin(projectRoot: string): unknown {
	const rdir = normalize(join(projectRoot, "server", "routes"));
	const regen = () => writeServerRoutesGen(projectRoot);
	return {
		name: "gen-server-routes",
		enforce: "pre" as const,
		buildStart() {
			regen();
		},
		configureServer(server: ViteDevServer) {
			regen();
			if (existsSync(rdir)) server.watcher.add(rdir);
			const onFs = (file: string) => {
				if (normalize(file).startsWith(rdir) && /\.(tsx?|jsx?)$/.test(file)) regen();
			};
			server.watcher.on("add", onFs);
			server.watcher.on("change", onFs);
			server.watcher.on("unlink", onFs);
		},
	};
}
