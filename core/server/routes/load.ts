import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import type { CorsRule } from "../middlewares/cors";
import type { SizeLimitOpts } from "../middlewares/logic/opts";
import { resetRateLimitBuckets } from "../middlewares/limit";
import { getServerFn } from "./rpc/registry";
import { isServerRoute, type ServerFn, type ServerRouteDesc } from "./rpc/types";
import { uncacheModulesUnderDir } from "./module-cache";
import { excludeDevtoolsFromRouteWalk, pathFromExport, walkRouteFiles } from "./route-fs";
import { routeCors, routeMeta, routeRegistry, routesState } from "./state";
import { writeServerRoutesGen } from "./generate";

let routeImportGen = 0;

function applyRouteRegistrySwap(
	nextRegistry: Map<string, ServerFn>,
	nextCors: Map<string, CorsRule>,
	nextMeta: Map<string, { sizeLimit?: SizeLimitOpts }>,
): void {
	routeRegistry.clear();
	for (const [k, v] of nextRegistry) routeRegistry.set(k, v);
	routeCors.clear();
	for (const [k, v] of nextCors) routeCors.set(k, v);
	routeMeta.clear();
	for (const [k, v] of nextMeta) routeMeta.set(k, v);
	resetRateLimitBuckets();
}

export async function loadServerRoutes(root: string): Promise<void> {
	routeImportGen += 1;
	const gen = routeImportGen;
	const ROUTES_DIR = join(root, "server", "routes");

	writeServerRoutesGen(root);

	if (!existsSync(ROUTES_DIR)) {
		routeRegistry.clear();
		routeCors.clear();
		routeMeta.clear();
		resetRateLimitBuckets();
		routesState.loaded = true;
		return;
	}

	uncacheModulesUnderDir(ROUTES_DIR);

	const nextRegistry = new Map<string, ServerFn>();
	const nextCors = new Map<string, CorsRule>();
	const nextMeta = new Map<string, { sizeLimit?: SizeLimitOpts }>();
	const byPath = new Map<string, string>();
	let importFailed = false;

	try {
		for (const file of walkRouteFiles(ROUTES_DIR, {
			skipLeadingUnderscoreDirs: false,
			excludeDevtools: excludeDevtoolsFromRouteWalk(),
		})) {
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
			} catch (e) {
				importFailed = true;
				console.warn(`[server/routes] import fallito (saltato), altre route possono restare valide: ${file}`, e);
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
				nextRegistry.set(path, getServerFn(desc));
				if (desc.cors != null) nextCors.set(path, desc.cors);
				if (desc.sizeLimit != null) nextMeta.set(path, { sizeLimit: desc.sizeLimit });
			}
		}
	} catch (e) {
		console.error("[server/routes] ricaricamento annullato:", e);
		routesState.loaded = true;
		return;
	}

	if (importFailed) {
		console.warn(
			"[server/routes] alcuni file non importati; registry aggiornato solo con le route caricate correttamente.",
		);
	}

	applyRouteRegistrySwap(nextRegistry, nextCors, nextMeta);
	routesState.loaded = true;
}
