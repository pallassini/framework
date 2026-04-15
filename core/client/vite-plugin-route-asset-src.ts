import fs from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";
import { syncRouteAssetInlineTypes } from "./route-asset-inline-gen";

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

function urlRelFromModule(id: string, abs: string): string {
	return path.relative(path.dirname(id), abs).replace(/\\/g, "/");
}

/**
 * Nei moduli sotto `client/routes`, `src` / `poster` con `./…` o `../…` sono risolti rispetto al file
 * del modulo (come `new URL` + Vite). Esempio: da `…/hero/index.tsx`, `./_assets/logo.webm` → `…/hero/_assets/logo.webm`.
 */
export function routeAssetSrcPlugin(projectRoot: string): Plugin {
	const routesRoot = path.join(projectRoot, "client", "routes");
	const attrRe = /((?:src|poster)\s*=\s*)(["'])(\.\.?\/[^"']+)\2/g;

	return {
		name: "route-asset-src",
		enforce: "pre",
		buildStart() {
			syncRouteAssetInlineTypes(projectRoot);
		},
		transform(code, id) {
			const normId = id.replace(/\\/g, "/");
			if (!normId.includes("/client/routes/")) return null;
			if (!/\.(m?[jt]sx?)$/.test(id)) return null;

			let replaced = false;
			const out = code.replace(attrRe, (full, prefix: string, q: string, rel: string) => {
				if (!rel || rel === "./" || rel === "../") return full;
				if (rel === "./_assets") {
					this.error(`[route-asset-src] usa ./_assets/nomefile.ext (${id})`);
				}

				const abs = path.resolve(path.dirname(id), rel);
				if (!isUnderDir(abs, routesRoot)) {
					this.warn(`[route-asset-src] path fuori da client/routes: ${rel} (${id})`);
					return full;
				}

				if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
					this.error(
						`[route-asset-src] file non trovato: ${rel} → ${path.relative(projectRoot, abs)}`,
					);
				}
				if (!shouldBundleAsAsset(abs)) {
					return full;
				}

				const urlRel = urlRelFromModule(id, abs);
				replaced = true;
				return `${prefix}{new URL(${JSON.stringify(urlRel)}, import.meta.url).href}`;
			});

			return replaced ? out : null;
		},
	};
}
