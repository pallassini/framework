import { normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** Svuota `require.cache` per moduli sotto `dir` (dev / hot reload Bun). */
export function uncacheModulesUnderDir(dir: string): void {
	const root = normalize(resolve(dir)).toLowerCase();
	const cache = require.cache as Record<string, unknown>;
	for (const key of Object.keys(cache)) {
		let pathStr = key;
		if (key.startsWith("file:")) {
			try {
				pathStr = fileURLToPath(key);
			} catch {
				continue;
			}
		}
		if (normalize(pathStr).toLowerCase().startsWith(root)) {
			delete cache[key];
		}
	}
}
