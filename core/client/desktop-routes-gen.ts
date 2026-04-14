/**
 * Plugin Vite: rigenera `core/client/desktop/routes-gen.ts` quando cambia `desktop/routes/**`.
 */
import { existsSync } from "node:fs";
import { join, normalize } from "node:path";
import type { Plugin, ViteDevServer } from "vite";
import { writeDesktopRoutesGen } from "../desktop/routes/write-client-routes-gen";
import { isFileUnderDir } from "./is-file-under-dir";

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
