import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { uncacheModulesUnderDir } from "../../server/routes/module-cache";
import { pathFromExport, walkRouteFiles } from "../../server/routes/route-fs";
import { getDesktopFn } from "./registry";
import { desktopRouteRegistry, desktopRoutesState } from "./state";
import { isDesktopRoute, type DesktopRouteDesc } from "./types";

let routeImportGen = 0;

export async function loadDesktopRoutes(root: string): Promise<void> {
	routeImportGen += 1;
	const gen = routeImportGen;
	const ROUTES_DIR = join(root, "desktop", "routes");

	desktopRouteRegistry.clear();

	if (!existsSync(ROUTES_DIR)) {
		desktopRoutesState.loaded = true;
		return;
	}

	uncacheModulesUnderDir(ROUTES_DIR);

	const byPath = new Map<string, string>();

	for (const file of walkRouteFiles(ROUTES_DIR)) {
		let mod: Record<string, unknown>;
		try {
			const href = Bun.pathToFileURL(file).href;
			let mtime = 0;
			try {
				mtime = statSync(file).mtimeMs;
			} catch {
				/* */
			}
			const url = `${href}?fwDesktopRouteGen=${gen}&t=${mtime}`;
			mod = (await import(url)) as Record<string, unknown>;
		} catch {
			continue;
		}

		for (const [exportName, value] of Object.entries(mod)) {
			if (!isDesktopRoute(value)) continue;
			const path = pathFromExport(ROUTES_DIR, file, exportName);
			if (!path) continue;

			const prev = byPath.get(path);
			if (prev) {
				throw new Error(`[desktop/routes] path duplicato "${path}" (${prev} vs ${file}#${exportName})`);
			}
			byPath.set(path, `${file}#${exportName}`);

			const desc = value as DesktopRouteDesc;
			const fn = getDesktopFn(desc);
			desktopRouteRegistry.set(path, (raw) => fn(raw, { routeName: path }));
		}
	}

	desktopRoutesState.loaded = true;
}
