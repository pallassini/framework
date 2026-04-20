/**
 * Dev: quando il motore fwdb persiste su disco (`core/db/data` o `FWDB_DATA`),
 * notifica il client via HMR custom così i devtools DB possono rifare fetch senza refresh manuale.
 */
import { existsSync } from "node:fs";
import { join, normalize } from "node:path";
import type { Plugin, ViteDevServer } from "vite";
import { FW_DB_DATA_CHANGED_EVENT } from "../fw-db-schema-reload-event";
import { isFileUnderDir } from "./is-file-under-dir";

function resolveFwdbDataDirForWatch(projectRoot: string): string {
	const env = process.env.FWDB_DATA?.trim();
	if (env) return normalize(env);
	return normalize(join(projectRoot, "core", "db", "data"));
}

export function genFwDbDataWatch(projectRoot: string): Plugin {
	const dataDir = resolveFwdbDataDirForWatch(projectRoot);
	let debounce: ReturnType<typeof setTimeout> | undefined;

	return {
		name: "fwdb-data-watch",
		configureServer(server: ViteDevServer) {
			if (!existsSync(dataDir)) return;

			server.watcher.add(dataDir);

			const schedule = () => {
				if (debounce != null) clearTimeout(debounce);
				debounce = setTimeout(() => {
					debounce = undefined;
					server.hot.send({
						type: "custom",
						event: FW_DB_DATA_CHANGED_EVENT,
					});
				}, 200);
			};

			const onFs = (file: string) => {
				if (!isFileUnderDir(file, dataDir)) return;
				schedule();
			};

			server.watcher.on("change", onFs);
			server.watcher.on("add", onFs);
			server.watcher.on("unlink", onFs);
		},
	};
}
