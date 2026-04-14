import { normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

/** Percorso file da chiave `require.cache` (Bun può usare `file:...?query`). */
function cacheKeyToFsPath(key: string): string | undefined {
	if (key.startsWith("file:")) {
		try {
			const u = new URL(key);
			u.search = "";
			u.hash = "";
			return normalize(fileURLToPath(u.href));
		} catch {
			return undefined;
		}
	}
	return normalize(key);
}

/** Svuota `require.cache` per moduli sotto `dir` (dev / hot reload Bun). */
export function uncacheModulesUnderDir(dir: string): void {
	const root = normalize(resolve(dir)).toLowerCase();
	const prefix = root.endsWith(sep) ? root : `${root}${sep}`;
	const cache = require.cache as Record<string, unknown>;
	for (const key of Object.keys(cache)) {
		const pathStr = cacheKeyToFsPath(key);
		if (pathStr == null) continue;
		const n = normalize(pathStr).toLowerCase();
		if (n === root || n.startsWith(prefix)) {
			delete cache[key];
		}
	}
}
