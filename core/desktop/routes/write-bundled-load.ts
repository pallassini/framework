import { existsSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { walkRouteFiles } from "../../server/routes/route-fs";

/** Rigenera `bundled.generated.ts` prima di `electrodun build` (route nel bundle, non su disco in prod). */
export function writeDesktopBundledLoad(projectRoot: string): void {
	const routesDir = join(projectRoot, "desktop", "routes");
	const outPath = join(projectRoot, "core", "desktop", "routes", "bundled.generated.ts");
	const genDir = dirname(outPath);

	if (!existsSync(routesDir)) {
		writeFileSync(
			outPath,
			`/**
 * Auto-generato. Non modificare.
 */

import { applyBundledDesktopRouteModules } from "./bundled-apply";

export async function loadBundledDesktopRoutes(): Promise<void> {
	await applyBundledDesktopRouteModules([]);
}
`,
			"utf8",
		);
		return;
	}

	const files = walkRouteFiles(routesDir);
	const importLines: string[] = [];
	const entryLines: string[] = [];
	for (let i = 0; i < files.length; i++) {
		const abs = files[i]!;
		let relImport = relative(genDir, abs).replace(/\\/g, "/");
		relImport = relImport.replace(/\.(tsx?)$/, "");
		if (!relImport.startsWith(".")) relImport = `./${relImport}`;
		importLines.push(`import * as mod${i} from "${relImport}";`);
		const relFromRoutes = relative(routesDir, abs).replace(/\\/g, "/");
		entryLines.push(
			`	{ relPath: ${JSON.stringify(relFromRoutes)}, mod: mod${i} as Record<string, unknown> },`,
		);
	}

	const body = `/**
 * Auto-generato da write-bundled-load.ts. Non modificare.
 */

${importLines.join("\n")}

import { applyBundledDesktopRouteModules } from "./bundled-apply";

export async function loadBundledDesktopRoutes(): Promise<void> {
	await applyBundledDesktopRouteModules([
${entryLines.join("\n")}
	]);
}
`;
	writeFileSync(outPath, body, "utf8");
}
