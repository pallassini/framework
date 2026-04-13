import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { resetRateLimitBuckets } from "../middlewares/limit";
import { getServerFn } from "./rpc/registry";
import { isServerRoute, type ServerRouteDesc } from "./rpc/types";
import { uncacheModulesUnderDir } from "./module-cache";
import { pathFromExport, walkRouteFiles } from "./route-fs";
import { routeCors, routeMeta, routeRegistry, routesState } from "./state";
import { writeServerRoutesGen } from "./generate";

let routeImportGen = 0;

export async function loadServerRoutes(root: string): Promise<void> {
	routeImportGen += 1;
	const gen = routeImportGen;
	const ROUTES_DIR = join(root, "server", "routes");

	routeRegistry.clear();
	routeCors.clear();
	routeMeta.clear();
	resetRateLimitBuckets();

	writeServerRoutesGen(root);

	if (!existsSync(ROUTES_DIR)) {
		routesState.loaded = true;
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
			const url = `${href}?fwRouteGen=${gen}&t=${mtime}`;
			mod = (await import(url)) as Record<string, unknown>;
		} catch {
			continue;
		}

		for (const [exportName, value] of Object.entries(mod)) {
			if (!isServerRoute(value)) continue;
			const path = pathFromExport(ROUTES_DIR, file, exportName);
			if (!path) continue;

			const prev = byPath.get(path);
			if (prev) {
				throw new Error(`[server/routes] path duplicato "${path}" (${prev} vs ${file}#${exportName})`);
			}
			byPath.set(path, `${file}#${exportName}`);

			const desc = value as ServerRouteDesc;
			routeRegistry.set(path, getServerFn(desc));
			if (desc.cors != null) routeCors.set(path, desc.cors);
			else routeCors.delete(path);
			if (desc.sizeLimit != null) routeMeta.set(path, { sizeLimit: desc.sizeLimit });
			else routeMeta.delete(path);
		}
	}

	routesState.loaded = true;
}
