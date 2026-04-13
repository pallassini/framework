import { getDesktopFn } from "./registry";
import { desktopRouteRegistry, desktopRoutesState } from "./state";
import { isDesktopRoute, type DesktopRouteDesc } from "./types";

function rpcPathFromRelRoutesFile(relPath: string, exportName: string): string {
	const parts = relPath.split(/[\\/]/g);
	const base = parts[parts.length - 1]!.replace(/\.(tsx?|jsx?)$/, "");
	const dirs = parts.slice(0, -1);
	const segs = [...dirs];
	if (base !== "index") segs.push(base);
	if (exportName !== "default") segs.push(exportName);
	return segs.join(".");
}

/** Route desktop incluse nel bundle Bun (app Electrobun installata, senza `desktop/routes` su disco). */
export async function applyBundledDesktopRouteModules(
	entries: { relPath: string; mod: Record<string, unknown> }[],
): Promise<void> {
	desktopRouteRegistry.clear();
	const byPath = new Map<string, string>();
	for (const { relPath, mod } of entries) {
		for (const [exportName, value] of Object.entries(mod)) {
			if (!isDesktopRoute(value)) continue;
			const path = rpcPathFromRelRoutesFile(relPath, exportName);
			const prev = byPath.get(path);
			if (prev) {
				throw new Error(`[desktop bundled] path duplicato "${path}" (${prev} vs ${relPath}#${exportName})`);
			}
			byPath.set(path, `${relPath}#${exportName}`);
			const fn = getDesktopFn(value as DesktopRouteDesc);
			desktopRouteRegistry.set(path, (raw) => fn(raw, { routeName: path, rpcLogParts: [] }));
		}
	}
	desktopRoutesState.loaded = true;
}
