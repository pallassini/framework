import { existsSync, watch } from "node:fs";
import { join } from "node:path";
import { desktopConfig } from "../../../desktop/config";
import { loadDesktopRoutes } from "./load";
import { desktopRoutesState } from "./state";
import { writeDesktopRoutesGen } from "./write-client-routes-gen";

/** Ricarica registry + stub client quando cambiano `desktop/routes`. */
export function watchDesktopRoutes(projectRoot: string): void {
	const routesDir = join(projectRoot, "desktop", "routes");
	let t: ReturnType<typeof setTimeout> | undefined;

	const schedule = () => {
		if (t != null) clearTimeout(t);
		t = setTimeout(() => {
			writeDesktopRoutesGen(projectRoot);
			void loadDesktopRoutes(projectRoot).then(() => {
				if (desktopConfig.log.registryReload !== false) {
					console.log("[desktop/routes] registry ricaricato");
				}
			});
		}, 150);
	};

	try {
		desktopRoutesState.routesWatcher?.close();
	} catch {
		/* */
	}

	if (!existsSync(routesDir)) return;

	// Qualsiasi evento (anche cartelle nuove / rename): su Windows `filename` spesso non ha estensione.
	desktopRoutesState.routesWatcher = watch(routesDir, { recursive: true }, () => {
		schedule();
	});
}
