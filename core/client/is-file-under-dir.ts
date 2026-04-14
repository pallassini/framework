import { normalize } from "node:path";

/** Confronto path robusto (Windows: case-insensitive, separator normalizzati). */
export function isFileUnderDir(file: string, dir: string): boolean {
	const f = normalize(file);
	const d = normalize(dir);
	if (process.platform === "win32") {
		const fl = f.toLowerCase();
		const dl = d.toLowerCase();
		return fl === dl || fl.startsWith(`${dl}\\`) || fl.startsWith(`${dl}/`);
	}
	return f === d || f.startsWith(`${d}\\`) || f.startsWith(`${d}/`);
}
