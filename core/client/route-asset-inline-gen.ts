import fs from "node:fs";
import path from "node:path";

/** Estensioni allineate a `vite-plugin-route-asset-src.ts` (solo file che il bundler tratta come asset). */
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

const SKIP_DIR = new Set(["node_modules", ".git", "dist", "build"]);

function collectClientMediaLiterals(projectRoot: string): string[] {
	const clientRoot = path.join(projectRoot, "client");
	if (!fs.existsSync(clientRoot)) return [];

	const literals = new Set<string>();

	function walk(d: string): void {
		for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
			if (SKIP_DIR.has(ent.name)) continue;
			const p = path.join(d, ent.name);
			if (ent.isDirectory()) {
				walk(p);
				continue;
			}
			if (ent.name.endsWith(".ts") || ent.name.endsWith(".tsx")) continue;
			const ext = path.extname(ent.name).toLowerCase();
			if (!MEDIA_OR_FONT.has(ext)) continue;

			const relFromClient = path.relative(clientRoot, p).replace(/\\/g, "/");
			literals.add(relFromClient);
		}
	}

	walk(clientRoot);
	return [...literals].sort();
}

/**
 * Aggiorna `RouteAssetInlineSrc` scansionando **tutta** `client/**` (i `.ts`/`.tsx` non entrano nel tipo).
 * Elenco path posix sotto `client/`. In JSX i `src` usano `./…`/`../…` relativi al file (es. `./_assets/x` accanto al modulo).
 */
export function syncRouteAssetInlineTypes(projectRoot: string): void {
	const paths = collectClientMediaLiterals(projectRoot);
	const outPath = path.join(projectRoot, "core", "client", "generated", "route-asset-inline-paths.ts");

	const typeDef =
		paths.length === 0
			? "export type RouteAssetInlineSrc = string;\n"
			: `export type RouteAssetInlineSrc =\n${paths.map((p) => `\t| ${JSON.stringify(p)}`).join("\n")};\n`;

	const content = `/* Auto-generated: media sotto client/** (esclusi .ts/.tsx). In JSX: path relativi al file (es. ./_assets/nome.ext nella stessa cartella del .tsx). */

${typeDef}`;
	fs.mkdirSync(path.dirname(outPath), { recursive: true });
	fs.writeFileSync(outPath, content, "utf8");
}
