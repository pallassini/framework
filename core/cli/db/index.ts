/**
 * CLI: `bun run db push` — raccoglie tutti gli export `defineTable` da `db/index.ts` e scrive `catalog.json`.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { bundleTables, isFwTable, type FwTable } from "../../db/schema/table";

const root = process.env.FRAMEWORK_PROJECT_ROOT?.trim() || process.cwd();

function normalizeJson(s: string): string {
	try {
		return JSON.stringify(JSON.parse(s));
	} catch {
		return s.trim();
	}
}

async function push(): Promise<void> {
	const modUrl = pathToFileURL(path.join(root, "db", "index.ts")).href;
	const dbMod = (await import(modUrl)) as Record<string, unknown>;

	const tables: FwTable<unknown>[] = [];
	for (const key of Object.keys(dbMod)) {
		if (key === "default" || key.startsWith("_")) continue;
		const val = dbMod[key];
		if (isFwTable(val)) tables.push(val);
	}

	if (tables.length === 0) {
		console.error("[db push] nessuna tabella: esporta `export const nome = defineTable(...)` in db/index.ts.");
		process.exit(1);
	}

	const merged = bundleTables(tables);

	const dataDir = process.env.FWDB_DATA?.trim() || path.join(root, "data");
	const catPath = path.join(dataDir, "catalog.json");

	let prev: string | null = null;
	if (existsSync(catPath)) prev = readFileSync(catPath, "utf8");

	const next = merged.toJSON();
	if (prev != null && normalizeJson(prev) === normalizeJson(next)) {
		console.log(`[db push] catalog invariato → ${catPath}`);
		return;
	}

	if (prev != null) {
		console.log(
			"[db push] catalog cambiato: riscrivo catalog.json (righe JSON esistenti restano su disco; verifica FK/indici).",
		);
	} else {
		console.log("[db push] primo catalog in", dataDir);
	}

	merged.writeCatalogSync(dataDir);
	console.log(`[db push] OK → ${catPath}`);
	console.log("[db push] Riavvia il server Bun per ricaricare il catalog.");
}

const cmd = process.argv[2]?.trim();
if (cmd !== "push") {
	console.error("Uso: bun run db push");
	console.error("Variabili: FWDB_DATA (directory dati), FRAMEWORK_PROJECT_ROOT (root progetto).");
	process.exit(1);
}

await push();
