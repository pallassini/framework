/**
 * Plugin Vite: rigenera `core/client/desktop/routes-gen.ts` quando cambia `desktop/routes/**`.
 */
import { existsSync } from "node:fs";
import { join, normalize } from "node:path";
import type { Plugin, ViteDevServer } from "vite";
import { writeDesktopRoutesGen } from "../desktop/routes/write-client-routes-gen";

export function genDesktopRoutes(projectRoot: string): Plugin {
	const rdir = normalize(join(projectRoot, "desktop", "routes"));
	const regen = () => writeDesktopRoutesGen(projectRoot);
	return {
		name: "desktop-routes-gen",
		enforce: "pre",
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
