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

/**
 * Invalida tutti i moduli "utente" del progetto (tutto sotto `projectRoot`)
 * ESCLUSI:
 *  - `node_modules`
 *  - i moduli di runtime del server (che contengono state vivo, es. `routeRegistry`, `Bun.serve`, ecc.)
 *    → `core/server/` e `core/db/` e `core/cli/`.
 *
 * Così, modificando qualunque file in `server/`, `db/`, `client/` (e anche la radice),
 * il prossimo import dinamico delle route rileggerà i sorgenti aggiornati,
 * comprese le loro transitive (es. helper locali, `../auth/index`, `db`, ecc.).
 */
export function uncacheUserModules(projectRoot: string): void {
	const root = normalize(resolve(projectRoot)).toLowerCase();
	const prefix = root.endsWith(sep) ? root : `${root}${sep}`;
	const nodeModulesFrag = `${sep}node_modules${sep}`;

	const coreExcluded = [
		`${prefix}core${sep}server${sep}`,
		`${prefix}core${sep}db${sep}`,
		`${prefix}core${sep}cli${sep}`,
	];

	const cache = require.cache as Record<string, unknown>;
	for (const key of Object.keys(cache)) {
		const pathStr = cacheKeyToFsPath(key);
		if (pathStr == null) continue;
		const n = normalize(pathStr).toLowerCase();
		if (!(n === root || n.startsWith(prefix))) continue;
		if (n.includes(nodeModulesFrag)) continue;
		let skip = false;
		for (const ex of coreExcluded) {
			if (n.startsWith(ex)) {
				skip = true;
				break;
			}
		}
		if (skip) continue;
		delete cache[key];
	}
}
