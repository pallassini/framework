import fs from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";

/** Estensioni da passare a Vite come asset (no sorgenti). */
const MEDIA_OR_FONT = new Set(
	[
		".png",
		".jpg",
		".jpeg",
		".webp",
		".gif",
		".svg",
		".ico",
		".avif",
		".apng",
		".webm",
		".mp4",
		".mov",
		".m4v",
		".ogg",
		".mp3",
		".wav",
		".aac",
		".m4a",
		".woff",
		".woff2",
		".ttf",
		".otf",
	].map((e) => e.toLowerCase()),
);

function isUnderDir(file: string, dir: string): boolean {
	const rel = path.relative(dir, file);
	return rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel);
}

function shouldBundleAsAsset(absFile: string): boolean {
	const ext = path.extname(absFile).toLowerCase();
	return MEDIA_OR_FONT.has(ext);
}

/**
 * Nei moduli sotto `client/routes`, risolve `src="./…"` / `src="../…"` rispetto al file
 * del modulo (come `new URL` + Vite). Solo file reali sotto `client/routes` e con
 * estensione media/font.
 */
export function routeAssetSrcPlugin(projectRoot: string): Plugin {
	const routesRoot = path.join(projectRoot, "client", "routes");
	const attrRe = /(src\s*=\s*)(["'])(\.\.?\/[^"']+)\2/g;

	return {
		name: "route-asset-src",
		enforce: "pre",
		transform(code, id) {
			const normId = id.replace(/\\/g, "/");
			if (!normId.includes("/client/routes/")) return null;
			if (!/\.(m?[jt]sx?)$/.test(id)) return null;

			let replaced = false;
			const out = code.replace(attrRe, (full, prefix: string, q: string, rel: string) => {
				if (!rel || rel === "./" || rel === "../") return full;

				const abs = path.resolve(path.dirname(id), rel);
				if (!isUnderDir(abs, routesRoot)) {
					this.warn(`[route-asset-src] path fuori da client/routes: ${rel} (${id})`);
					return full;
				}
				if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
					return full;
				}
				if (!shouldBundleAsAsset(abs)) {
					return full;
				}

				replaced = true;
				return `${prefix}{new URL(${JSON.stringify(rel)}, import.meta.url).href}`;
			});

			return replaced ? out : null;
		},
	};
}
