import { existsSync, watch } from "node:fs";
import { join } from "node:path";
import { serverConfig } from "../../../server/config";
import { loadServerRoutes } from "./load";
import { routesState } from "./state";

/** Hot reload registry quando cambiano i file in `server/routes`. */
export function watchServerRoutes(projectRoot: string): void {
	const routesDir = join(projectRoot, "server", "routes");
	let t: ReturnType<typeof setTimeout> | undefined;

	const schedule = () => {
		if (t != null) clearTimeout(t);
		t = setTimeout(() => {
			void loadServerRoutes(projectRoot).then(() => {
				if (serverConfig.log.registryReload !== false) {
					console.log("[server/routes] registry ricaricato");
				}
			});
		}, 150);
	};

	try {
		routesState.routesWatcher?.close();
	} catch {
		/* */
	}

	if (!existsSync(routesDir)) return;

	routesState.routesWatcher = watch(routesDir, { recursive: true }, (_event, filename) => {
		if (filename == null || /\.(tsx?|jsx?)$/i.test(filename)) schedule();
	});
}
