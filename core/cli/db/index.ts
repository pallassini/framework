/**
 * CLI DB:
 *   bun db push                           → scrive catalog.json locale dal bundle di db/index.ts
 *   bun db push --to <alias>              → invia il catalog locale a un server remoto (hot reload)
 *   bun db pull --from <alias>            → scarica il catalog dal remoto e sovrascrive il locale
 *   bun db pull --from <alias> --data     → scarica anche wal.log (dati)
 *   bun db push-data --to <alias>         → invia wal.log locale al remoto (rischioso: sovrascrive dati)
 *
 * Gli alias sono definiti in `db/remotes.ts` (env var `FWDB_REMOTE_<ALIAS>_URL` / `_PASSWORD`).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { collectModuleTables } from "../../db/collect";
import { FWDB_DEFAULT_DATA_REL_PATH } from "../../db/core/customDb";
import { bundleTables } from "../../db/schema/table";
import {
	REMOTE_ADMIN_RPC_PATH,
	REMOTE_ADMIN_WAL_PATH,
	REMOTE_ADMIN_WAL_UPLOAD_PATH,
	REMOTE_AUTH_HEADER,
} from "../../db/remote/protocol";
import { loadRemoteRegistry, resolveRemoteTarget } from "../../db/remote/resolve";
import type { RemoteTarget } from "../../db/remote/client";

const root = process.env.FRAMEWORK_PROJECT_ROOT?.trim() || process.cwd();

function normalizeJson(s: string): string {
	try {
		return JSON.stringify(JSON.parse(s));
	} catch {
		return s.trim();
	}
}

type MergedCatalog = { toJSON: () => string; writeCatalogSync: (dir: string) => void };

function parseFlags(argv: readonly string[]): { positional: string[]; flags: Map<string, string | true> } {
	const positional: string[] = [];
	const flags = new Map<string, string | true>();
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i]!;
		if (a.startsWith("--")) {
			const key = a.slice(2);
			const next = argv[i + 1];
			if (next !== undefined && !next.startsWith("--")) {
				flags.set(key, next);
				i++;
			} else {
				flags.set(key, true);
			}
		} else {
			positional.push(a);
		}
	}
	return { positional, flags };
}

async function loadLocalCatalogStr(): Promise<{ str: string; dataDir: string }> {
	const modUrl = pathToFileURL(path.join(root, "db", "index.ts")).href;
	const dbMod = (await import(modUrl)) as Record<string, unknown>;
	let merged: MergedCatalog;
	const def = dbMod.default;
	if (
		def != null &&
		typeof def === "object" &&
		"writeCatalogSync" in def &&
		typeof (def as MergedCatalog).writeCatalogSync === "function" &&
		"catalog" in def
	) {
		merged = def as unknown as MergedCatalog;
	} else {
		const tables = collectModuleTables(dbMod);
		if (tables.length === 0) {
			throw new Error(
				"[db] nessuna tabella: esporta `FwTable` o shape plain in db/index.ts.",
			);
		}
		merged = bundleTables(tables);
	}
	const dataDir = process.env.FWDB_DATA?.trim() || path.join(root, FWDB_DEFAULT_DATA_REL_PATH);
	return { str: merged.toJSON(), dataDir };
}

async function resolveAlias(alias: string): Promise<RemoteTarget> {
	const registry = await loadRemoteRegistry(root);
	return resolveRemoteTarget(alias, registry);
}

async function rpcCall<T>(target: RemoteTarget, body: unknown): Promise<T> {
	const url = target.baseUrl.replace(/\/+$/, "") + REMOTE_ADMIN_RPC_PATH;
	const res = await fetch(url, {
		method: "POST",
		headers: {
			"content-type": "application/json",
			[REMOTE_AUTH_HEADER]: `Bearer ${target.password}`,
		},
		body: JSON.stringify({ input: body }),
	});
	const text = await res.text();
	if (!res.ok) {
		throw new Error(`[db cli] remoto ${target.alias} risposta ${res.status}: ${text}`);
	}
	try {
		return JSON.parse(text) as T;
	} catch {
		throw new Error(`[db cli] risposta non JSON da ${target.alias}: ${text.slice(0, 200)}`);
	}
}

async function pushLocal(): Promise<void> {
	const modUrl = pathToFileURL(path.join(root, "db", "index.ts")).href;
	const dbMod = (await import(modUrl)) as Record<string, unknown>;

	let merged: MergedCatalog;
	const def = dbMod.default;
	if (
		def != null &&
		typeof def === "object" &&
		"writeCatalogSync" in def &&
		typeof (def as MergedCatalog).writeCatalogSync === "function" &&
		"catalog" in def
	) {
		merged = def as unknown as MergedCatalog;
	} else {
		const tables = collectModuleTables(dbMod);
		if (tables.length === 0) {
			console.error(
				"[db push] nessuna tabella: esporta `FwTable` o shape plain in db/index.ts.",
			);
			process.exit(1);
		}
		merged = bundleTables(tables);
	}

	const dataDir = process.env.FWDB_DATA?.trim() || path.join(root, FWDB_DEFAULT_DATA_REL_PATH);
	const catPath = path.join(dataDir, "catalog.json");

	let prev: string | null = null;
	if (existsSync(catPath)) prev = readFileSync(catPath, "utf8");

	const next = merged.toJSON();
	if (prev != null && normalizeJson(prev) === normalizeJson(next)) {
		console.log(`[db push] catalog invariato → ${catPath}`);
		return;
	}
	if (prev != null) {
		console.log("[db push] catalog cambiato: riscrivo catalog.json (righe JSON esistenti restano; verifica FK/indici).");
	} else {
		console.log("[db push] primo catalog in", dataDir);
	}

	merged.writeCatalogSync(dataDir);
	console.log(`[db push] OK → ${catPath}`);
	console.log("[db push] Riavvia il server Bun per ricaricare il catalog.");
}

async function pushToRemote(alias: string): Promise<void> {
	const target = await resolveAlias(alias);
	const { str } = await loadLocalCatalogStr();

	type Resp =
		| { ok: true; reloaded: true; tableNames: string[] }
		| { ok: false; error: { type: string; message: string } };
	const res = await rpcCall<Resp>(target, { op: "catalog.push", catalogJson: str });
	if (!("ok" in res) || res.ok !== true) {
		const err = (res as { error?: { type: string; message: string } }).error;
		console.error(`[db push --to ${alias}] FAILED: ${err?.type ?? "?"} ${err?.message ?? ""}`);
		process.exit(1);
	}
	console.log(
		`[db push --to ${alias}] OK → ${target.baseUrl} (tabelle: ${(res as { tableNames: string[] }).tableNames.join(", ")})`,
	);
}

async function pullFromRemote(alias: string, includeData: boolean): Promise<void> {
	const target = await resolveAlias(alias);

	type GetResp = { ok: true; catalog: unknown } | { ok: false; error: { type: string; message: string } };
	const res = await rpcCall<GetResp>(target, { op: "catalog.get" });
	if (!("ok" in res) || res.ok !== true) {
		const err = (res as { error?: { type: string; message: string } }).error;
		console.error(`[db pull --from ${alias}] catalog.get FAILED: ${err?.type ?? "?"} ${err?.message ?? ""}`);
		process.exit(1);
	}
	const catalog = (res as { catalog: unknown }).catalog;
	const dataDir = process.env.FWDB_DATA?.trim() || path.join(root, FWDB_DEFAULT_DATA_REL_PATH);
	mkdirSync(dataDir, { recursive: true });
	const catPath = path.join(dataDir, "catalog.json");
	writeFileSync(catPath, `${JSON.stringify(catalog)}\n`);
	console.log(`[db pull --from ${alias}] catalog → ${catPath}`);

	if (!includeData) return;

	const walUrl = target.baseUrl.replace(/\/+$/, "") + REMOTE_ADMIN_WAL_PATH;
	const walRes = await fetch(walUrl, {
		method: "GET",
		headers: { [REMOTE_AUTH_HEADER]: `Bearer ${target.password}` },
	});
	if (!walRes.ok) {
		const body = await walRes.text();
		console.error(`[db pull --from ${alias} --data] wal FAILED (${walRes.status}): ${body.slice(0, 200)}`);
		process.exit(1);
	}
	const buf = new Uint8Array(await walRes.arrayBuffer());
	const walPath = path.join(dataDir, "wal.log");
	writeFileSync(walPath, buf);
	console.log(`[db pull --from ${alias} --data] wal.log (${buf.byteLength} bytes) → ${walPath}`);
}

async function pushDataToRemote(alias: string): Promise<void> {
	const target = await resolveAlias(alias);
	const dataDir = process.env.FWDB_DATA?.trim() || path.join(root, FWDB_DEFAULT_DATA_REL_PATH);
	const walPath = path.join(dataDir, "wal.log");
	if (!existsSync(walPath)) {
		console.error(`[db push-data --to ${alias}] nessun wal.log in ${dataDir}`);
		process.exit(1);
	}
	const buf = readFileSync(walPath);
	const url = target.baseUrl.replace(/\/+$/, "") + REMOTE_ADMIN_WAL_UPLOAD_PATH;
	const res = await fetch(url, {
		method: "POST",
		headers: {
			"content-type": "application/octet-stream",
			[REMOTE_AUTH_HEADER]: `Bearer ${target.password}`,
		},
		body: buf,
	});
	const text = await res.text();
	if (!res.ok) {
		console.error(`[db push-data --to ${alias}] FAILED (${res.status}): ${text.slice(0, 200)}`);
		process.exit(1);
	}
	console.log(`[db push-data --to ${alias}] OK (${buf.byteLength} bytes) → ${target.baseUrl}`);
	console.log("[db push-data] ATTENZIONE: il server remoto va riavviato per rileggere il nuovo wal.log.");
}

async function main(): Promise<void> {
	const argv = process.argv.slice(2);
	const { positional, flags } = parseFlags(argv);
	const cmd = positional[0]?.trim();

	if (cmd === "push") {
		const to = flags.get("to");
		if (typeof to === "string" && to) {
			await pushToRemote(to);
		} else {
			await pushLocal();
		}
		return;
	}
	if (cmd === "pull") {
		const from = flags.get("from");
		if (typeof from !== "string" || !from) {
			console.error("[db pull] richiede --from <alias> (es: bun db pull --from prod)");
			process.exit(1);
		}
		const includeData = flags.get("data") === true;
		await pullFromRemote(from, includeData);
		return;
	}
	if (cmd === "push-data") {
		const to = flags.get("to");
		if (typeof to !== "string" || !to) {
			console.error("[db push-data] richiede --to <alias>");
			process.exit(1);
		}
		await pushDataToRemote(to);
		return;
	}
	console.error("Uso:");
	console.error("  bun db push                         # scrive catalog.json locale");
	console.error("  bun db push --to <alias>            # invia catalog al remoto (hot reload)");
	console.error("  bun db pull --from <alias>          # scarica catalog dal remoto");
	console.error("  bun db pull --from <alias> --data   # scarica anche i dati (wal.log)");
	console.error("  bun db push-data --to <alias>       # upload wal.log al remoto (sovrascrive i dati)");
	process.exit(1);
}

await main();
