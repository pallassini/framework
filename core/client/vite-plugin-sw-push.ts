import fs from "node:fs";
import path from "node:path";
import type { PluginContext } from "rollup";
import type { Plugin } from "vite";

const FILE = "sw-push.js";

/** Serve e bundle `core/client/push/sw-push.js` come `/{FILE}` alla root del sito. */
export function swPushPlugin(projectRoot: string): Plugin {
	const abs = path.join(projectRoot, "core", "client", "push", FILE);
	return {
		name: "fw-sw-push",
		configureServer(server) {
			server.middlewares.use((req, res, next) => {
				const pathname = req.url?.split("?")[0] ?? "";
				if (pathname !== `/${FILE}`) {
					next();
					return;
				}
				try {
					const body = fs.readFileSync(abs, "utf8");
					res.setHeader("Content-Type", "application/javascript; charset=utf-8");
					res.setHeader("Cache-Control", "no-cache");
					res.end(body);
				} catch {
					next();
				}
			});
		},
		generateBundle(this: PluginContext) {
			const source = fs.readFileSync(abs, "utf8");
			this.emitFile({ type: "asset", fileName: FILE, source });
		},
	};
}
