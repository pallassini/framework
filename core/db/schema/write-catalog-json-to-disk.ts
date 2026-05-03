import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { CatalogJson } from "./defineSchema";

/** Scrive `catalog.json` sotto `dir` (solo processi Node / CLI / server). */
export function writeCatalogJsonToDisk(dir: string, catalog: CatalogJson): void {
	mkdirSync(dir, { recursive: true });
	writeFileSync(join(dir, "catalog.json"), `${JSON.stringify(catalog)}\n`);
}
