import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { build } from "vite-plus";

export async function buildWeb(projectRoot: string): Promise<void> {
	await build({ configFile: path.join(projectRoot, "core/client/vite.config.ts") });
	const assets = path.join(projectRoot, "build/web/assets");
	if (!existsSync(assets)) mkdirSync(assets, { recursive: true });
}
