import { existsSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

export function walkRouteFiles(dir: string): string[] {
	if (!existsSync(dir)) return [];
	const out: string[] = [];
	for (const e of readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
		a.name.localeCompare(b.name),
	)) {
		if (e.name.startsWith("_")) continue;
		const full = join(dir, e.name);
		if (e.isDirectory()) out.push(...walkRouteFiles(full));
		else if (/\.(tsx?|jsx?)$/.test(e.name)) out.push(full);
	}
	return out;
}

/**
 * Path RPC (punti → `server.a.b.c()` sul client):
 * - Segmenti = cartelle + file (senza estensione), tranne se il file si chiama `index` → quel segmento non si aggiunge.
 * - `export default s(...)` → non aggiungi il nome export; `export const foo = s(...)` → suffisso `.foo`.
 * Esempi: `routes/ping.ts` default → `ping`; stesso file `export const meta` → `ping.meta`;
 * `routes/api/user.ts` default → `api.user`; `routes/api/index.ts` default → `api`.
 */
export function pathFromExport(routesDir: string, file: string, exportName: string): string {
	const rel = relative(routesDir, file);
	const parts = rel.split(/[\\/]/g);
	const base = parts[parts.length - 1]!.replace(/\.(tsx?|jsx?)$/, "");
	const dirs = parts.slice(0, -1);
	const segs = [...dirs];
	if (base !== "index") segs.push(base);
	if (exportName !== "default") segs.push(exportName);
	return segs.join(".");
}
