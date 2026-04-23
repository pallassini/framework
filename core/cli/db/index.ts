/**
 * CLI DB:
 *   bun db push                           → scrive catalog.json locale dal bundle di db/index.ts
 *   bun db push --to <alias>              → invia il catalog locale a un server remoto (hot reload)
 *   bun db pull --from <alias>            → scrive db/pulled.ts (reference TS, non tocca catalog.json)
 *   bun db pull --from <alias> --data     → scarica anche wal.log in core/db/data
 *   bun db push-data --to <alias>         → invia wal.log locale al remoto (rischioso: sovrascrive dati)
 *   bun db ping --to <alias> [--n N]      → misura latenza di rete + overhead DB verso il remoto
 *
 * Gli alias sono definiti in `db/config.ts` → `dbConfig.remotes`.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { collectModuleSchemas, collectModuleTableOrder, collectModuleTables } from "../../db/collect";
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
import { renderPulledTs, type SchemaNode as PulledSchemaNode } from "./pulled-writer";
import { cli, colors, humanBytes, humanMs, usage } from "./ui";

const root = process.env.FRAMEWORK_PROJECT_ROOT?.trim() || process.cwd();

function normalizeJson(s: string): string {
	try {
		return JSON.stringify(JSON.parse(s));
	} catch {
		return s.trim();
	}
}

function relPath(p: string): string {
	try {
		const r = path.relative(root, p);
		return r.startsWith("..") ? p : r.replace(/\\/g, "/");
	} catch {
		return p;
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

async function loadLocalCatalog(): Promise<{ merged: MergedCatalog; str: string; dataDir: string; tableCount: number }> {
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
			throw new Error("nessuna tabella: esporta `FwTable` o shape plain in db/index.ts.");
		}
		merged = bundleTables(tables);
	}
	const dataDir = process.env.FWDB_DATA?.trim() || path.join(root, FWDB_DEFAULT_DATA_REL_PATH);
	const str = merged.toJSON();
	let tableCount = 0;
	try {
		const obj = JSON.parse(str) as { tables?: Record<string, unknown> };
		tableCount = obj.tables ? Object.keys(obj.tables).length : 0;
	} catch {
		/* ignore */
	}
	return { merged, str, dataDir, tableCount };
}

async function resolveAlias(alias: string): Promise<RemoteTarget> {
	const registry = await loadRemoteRegistry(root);
	return resolveRemoteTarget(alias, registry);
}

/**
 * Carica `db/index.ts` locale e restituisce l'albero degli `schema([...])` e
 * l'ordine di dichiarazione delle tabelle. Serve come *fallback* nel `pull`:
 * gli `schema` sono pura dichiarazione TS e non finiscono nel catalog remoto;
 * se il server remoto è legacy (pre-schemaTree) o se vogliamo sempre la vista
 * canonica del sorgente locale, li ricaviamo da qui.
 */
async function loadLocalSchemaShape(): Promise<{
	schemaTree: PulledSchemaNode[];
	tableOrder: string[];
} | null> {
	try {
		const modUrl = pathToFileURL(path.join(root, "db", "index.ts")).href;
		const dbMod = (await import(modUrl)) as Record<string, unknown>;
		const { tree } = collectModuleSchemas(dbMod);
		const order = collectModuleTableOrder(dbMod);
		return {
			schemaTree: tree as unknown as PulledSchemaNode[],
			tableOrder: order,
		};
	} catch {
		return null;
	}
}

/** Rimuove `columns` dal catalog (solo meta serializzabile per confronto / diff). */
function stripColumnsFromCatalog(c: { tables: Record<string, unknown> }): Record<string, unknown> {
	return Object.fromEntries(
		Object.entries(c.tables).map(([k, v]) => {
			if (v && typeof v === "object") {
				const { columns: _cols, ...rest } = v as Record<string, unknown>;
				return [k, rest];
			}
			return [k, v];
		}),
	);
}

type CatalogTableDiff = { added: string[]; removed: string[]; modified: string[] };

function diffCatalogTables(
	remote: Record<string, unknown>,
	local: Record<string, unknown>,
): CatalogTableDiff {
	const r = new Set(Object.keys(remote));
	const l = new Set(Object.keys(local));
	const added = [...l].filter((k) => !r.has(k));
	const removed = [...r].filter((k) => !l.has(k));
	const modified: string[] = [];
	for (const k of l) {
		if (!r.has(k)) continue;
		if (JSON.stringify(remote[k]) !== JSON.stringify(local[k])) modified.push(k);
	}
	return { added, removed, modified };
}

/** Riassunto compatto per la prima riga del box (◆ delta …). */
function formatCatalogDelta(d: CatalogTableDiff): string {
	const parts: string[] = [];
	if (d.added.length > 0) parts.push(`+ ${d.added.join(", ")}`);
	if (d.removed.length > 0) parts.push(`− ${d.removed.join(", ")}`);
	if (d.modified.length > 0) parts.push(`~ ${d.modified.join(", ")}`);
	return parts.length > 0 ? parts.join(" · ") : "nessun delta a livello tabelle (controlla il JSON)";
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
		throw new Error(`remoto risposta ${String(res.status)}: ${text.slice(0, 300)}`);
	}
	try {
		return JSON.parse(text) as T;
	} catch {
		throw new Error(`risposta non JSON: ${text.slice(0, 200)}`);
	}
}

// ─── push locale ───────────────────────────────────────────────────────────────
async function pushLocal(): Promise<void> {
	const ui = cli("push", { subtitle: "local" });
	try {
		ui.step("carico db/index.ts");
		const { merged, str, dataDir, tableCount } = await loadLocalCatalog();
		ui.line("tables", String(tableCount));
		ui.line("dataDir", relPath(dataDir), "muted");

		const catPath = path.join(dataDir, "catalog.json");
		let prev: string | null = null;
		if (existsSync(catPath)) prev = readFileSync(catPath, "utf8");

		if (prev != null && normalizeJson(prev) === normalizeJson(str)) {
			ui.muted(`catalog invariato → ${relPath(catPath)}`);
			ui.end("noop");
			return;
		}

		if (prev != null) {
			ui.warn("catalog cambiato: riscrivo (righe esistenti restano, verifica FK/indici)");
		} else {
			ui.step(`primo catalog in ${relPath(dataDir)}`);
		}

		merged.writeCatalogSync(dataDir);
		ui.ok(`scritto → ${relPath(catPath)}`);
		ui.muted("riavvia il server Bun per ricaricare il catalog");
		ui.end("success");
	} catch (e) {
		ui.err(e instanceof Error ? e.message : String(e));
		ui.end("error");
		process.exit(1);
	}
}

// ─── push remoto ───────────────────────────────────────────────────────────────
/**
 * `bun db push --to <alias>`:
 *   1. Carica il catalog del `db/index.ts` locale (senza emettere nulla).
 *   2. Chiede al remoto il catalog attuale (`catalog.get`): se coincide a meno
 *      dello spazio, usciamo con `ALREADY IN SYNC` (grigio) senza fare il push.
 *   3. Altrimenti fa `catalog.push` (hot reload sul server) e stampa il riepilogo
 *      raggruppato per `schema([...])` dichiarato in `db/index.ts`.
 */
async function pushToRemote(alias: string): Promise<void> {
	const wallStart = performance.now();
	// Tutto il lavoro in silenzio (niente riquadro mentre pensiamo).
	// Prima raccogliamo i dati, poi apriamo il box e stampiamo pulito.
	let target: RemoteTarget;
	let localStr: string;
	let localShape: { schemaTree: PulledSchemaNode[]; tableOrder: string[] } | null = null;
	let tableCount = 0;

	try {
		target = await resolveAlias(alias);
	} catch (e) {
		const ui = cli("DB PUSH", { frame: "error" });
		ui.kv("error", e instanceof Error ? e.message : String(e), "info");
		ui.kv("time", humanMs(performance.now() - wallStart), "muted");
		ui.end("error");
		process.exit(1);
	}

	try {
		const loaded = await loadLocalCatalog();
		localStr = loaded.str;
		tableCount = loaded.tableCount;
		localShape = await loadLocalSchemaShape();
	} catch (e) {
		const ui = cli("DB PUSH", { frame: "error" });
		ui.kv("error", e instanceof Error ? e.message : String(e), "info");
		ui.kv("time", humanMs(performance.now() - wallStart), "muted");
		ui.kv("url", target.baseUrl, "muted");
		ui.end("error");
		process.exit(1);
	}

	const localTables = stripColumnsFromCatalog(JSON.parse(localStr) as { tables: Record<string, unknown> });

	// Confronto con il remoto per evitare push inutili (+ delta se serve push).
	let inSync = false;
	let tableDiff: CatalogTableDiff | null = null;
	try {
		type GetResp =
			| { ok: true; catalog: { tables: Record<string, unknown> } | null }
			| { ok: false; error: { type: string; message: string } };
		const remote = await rpcCall<GetResp>(target, { op: "catalog.get" });
		if ("ok" in remote && remote.ok === true && remote.catalog) {
			const remoteTables = stripColumnsFromCatalog(remote.catalog);
			inSync =
				JSON.stringify({ tables: remoteTables }) === JSON.stringify({ tables: localTables });
			if (!inSync) {
				tableDiff = diffCatalogTables(remoteTables, localTables);
			}
		}
	} catch {
		// se il confronto fallisce procediamo comunque col push
	}

	// Niente da fare: apri il box in modalità "already in sync" grigio.
	if (inSync) {
		const ui = cli("DB PUSH", { frame: "noop" });
		ui.kv("time", humanMs(performance.now() - wallStart), "muted");
		ui.kv("url", target.baseUrl, "muted");
		ui.kv("tables", String(tableCount), "muted");
		ui.kv("size", humanBytes(Buffer.byteLength(localStr, "utf8")), "muted");
		if (localShape && localShape.schemaTree.length > 0) {
			ui.group("schemas", buildSchemaGroupRows(localShape.schemaTree, tableNamesFromJson(localStr)));
		}
		ui.end("noop");
		return;
	}

	// Push vero e proprio.
	let tableNames: string[] = [];
	let ok = false;
	let errLine: string | null = null;
	try {
		type Resp =
			| { ok: true; reloaded: true; tableNames: string[] }
			| { ok: false; error: { type: string; message: string } };
		const res = await rpcCall<Resp>(target, { op: "catalog.push", catalogJson: localStr });
		if ("ok" in res && res.ok === true) {
			ok = true;
			tableNames = res.tableNames;
		} else {
			const e = (res as { error?: { type: string; message: string } }).error;
			errLine = `${e?.type ?? "?"}: ${e?.message ?? "risposta non valida dal remoto"}`;
		}
	} catch (e) {
		errLine = e instanceof Error ? e.message : String(e);
	}
	const wallElapsed = performance.now() - wallStart;

	const ui = cli("DB PUSH", { frame: ok ? "success" : "error" });

	if (!ok) {
		ui.kv("error", errLine ?? "push FAILED", "info");
		ui.kv("time", humanMs(wallElapsed), "muted");
		ui.kv("url", target.baseUrl, "muted");
		ui.kv("tables", String(tableCount), "muted");
		ui.kv("size", humanBytes(Buffer.byteLength(localStr, "utf8")), "muted");
		ui.end("error");
		process.exit(1);
	}

	const deltaLine =
		tableDiff != null
			? formatCatalogDelta(tableDiff)
			: "nessun confronto col remoto — applicato catalog locale";
	ui.kv("delta", deltaLine, "ok");
	ui.kv("time", humanMs(wallElapsed), "ok");
	ui.kv("url", target.baseUrl, "muted");
	ui.kv("tables", String(tableNames.length > 0 ? tableNames.length : tableCount), "ok");
	ui.kv("size", humanBytes(Buffer.byteLength(localStr, "utf8")), "muted");

	const effectiveTables = tableNames.length > 0 ? tableNames : tableNamesFromJson(localStr);
	if (localShape && localShape.schemaTree.length > 0) {
		ui.group("schemas", buildSchemaGroupRows(localShape.schemaTree, effectiveTables));
	} else {
		ui.kv("applied", effectiveTables.join(", "), "muted");
	}
	ui.end("pushed");
}

/**
 * Estrae `tables[*].name` dal catalog JSON; fallback per mostrare la lista
 * tabelle anche quando il remoto non la ri-elenca nella risposta.
 */
function tableNamesFromJson(jsonStr: string): string[] {
	try {
		const j = JSON.parse(jsonStr) as { tables?: Record<string, unknown> };
		return j.tables ? Object.keys(j.tables) : [];
	} catch {
		return [];
	}
}

/**
 * Trasforma lo `schemaTree` in righe `[schemaPath, "tab1, tab2, ..."]` pronte
 * per `ui.group`. Le tabelle non appartenenti a nessuno schema finiscono in
 * una riga finale `(ungrouped)`. Gli schemi che *compongono* altri schemi
 * (solo children, nessuna table diretta) sono saltati: le loro tabelle sono
 * già coperte dai figli, mostrarli due volte è rumore.
 */
function buildSchemaGroupRows(
	tree: readonly PulledSchemaNode[],
	allTables: readonly string[],
): (readonly [string, string])[] {
	const rows: [string, string][] = [];
	const covered = new Set<string>();
	const visit = (n: PulledSchemaNode): void => {
		if (n.tables.length > 0) {
			rows.push([n.name, n.tables.join(", ")]);
			for (const t of n.tables) covered.add(t);
		}
		for (const c of n.children) visit(c);
	};
	for (const root of tree) visit(root);
	const orphans = allTables.filter((t) => !covered.has(t));
	if (orphans.length > 0) rows.push(["(ungrouped)", orphans.join(", ")]);
	return rows;
}

// ─── pull ──────────────────────────────────────────────────────────────────────
async function pullFromRemote(alias: string, includeData: boolean): Promise<void> {
	const wallStart = performance.now();
	type CatalogShape = { tables: Record<string, Record<string, unknown>> };
	type GetResp =
		| {
				ok: true;
				catalog: CatalogShape;
				tableOrder?: string[];
				schemaTree?: PulledSchemaNode[];
		  }
		| { ok: false; error: { type: string; message: string } };

	let target: RemoteTarget;
	try {
		target = await resolveAlias(alias);
	} catch (e) {
		const ui = cli("DB PULL", { frame: "error" });
		ui.kv("error", e instanceof Error ? e.message : String(e), "info");
		ui.kv("time", humanMs(performance.now() - wallStart), "muted");
		ui.end("error");
		process.exit(1);
	}

	let res: GetResp;
	try {
		res = await rpcCall<GetResp>(target, { op: "catalog.get" });
	} catch (e) {
		const ui = cli("DB PULL", { frame: "error" });
		ui.kv("error", e instanceof Error ? e.message : String(e), "info");
		ui.kv("time", humanMs(performance.now() - wallStart), "muted");
		ui.kv("url", target.baseUrl, "muted");
		ui.end("error");
		process.exit(1);
	}

	if (!("ok" in res) || res.ok !== true) {
		const err = (res as { error?: { type: string; message: string } }).error;
		const msg = err?.message
			? `${err?.type ?? "?"}: ${err.message}`
			: `catalog.get rifiutato: ${err?.type ?? "?"}`;
		const ui = cli("DB PULL", { frame: "error" });
		ui.kv("error", msg, "info");
		ui.kv("time", humanMs(performance.now() - wallStart), "muted");
		ui.kv("url", target.baseUrl, "muted");
		ui.end("error");
		process.exit(1);
	}

	const payload = res as {
		catalog: CatalogShape;
		tableOrder?: string[];
		schemaTree?: PulledSchemaNode[];
	};
	const tableNames = Object.keys(payload.catalog.tables);
	const nCols = Object.values(payload.catalog.tables).reduce((acc, t) => {
		const cols = (t as { columns?: unknown[] }).columns;
		return acc + (Array.isArray(cols) ? cols.length : 0);
	}, 0);

	const localShape = await loadLocalSchemaShape();
	const schemaTree =
		payload.schemaTree && payload.schemaTree.length > 0
			? payload.schemaTree
			: (localShape?.schemaTree ?? []);
	const tableOrder =
		payload.tableOrder && payload.tableOrder.length > 0
			? payload.tableOrder
			: localShape?.tableOrder;

	const countSchemas = (arr: readonly PulledSchemaNode[]): number => {
		let c = 0;
		for (const n of arr) {
			c++;
			c += countSchemas(n.children);
		}
		return c;
	};
	const nSchemas = countSchemas(schemaTree);

	const pulledPath = path.join(root, "db", "pulled.ts");
	mkdirSync(path.dirname(pulledPath), { recursive: true });
	const previous = existsSync(pulledPath) ? readFileSync(pulledPath, "utf8") : null;
	const ts = renderPulledTs(
		payload.catalog as Parameters<typeof renderPulledTs>[0],
		tableOrder,
		alias,
		target.baseUrl,
		schemaTree,
	);
	const stripHeader = (s: string): string => s.replace(/^\/\*\*[\s\S]*?\*\/\s*/, "");
	const pulledChanged = previous == null || stripHeader(previous) !== stripHeader(ts);
	writeFileSync(pulledPath, ts);

	let walPath: string | null = null;
	let walBytes = 0;
	if (includeData) {
		const dataDir = process.env.FWDB_DATA?.trim() || path.join(root, FWDB_DEFAULT_DATA_REL_PATH);
		mkdirSync(dataDir, { recursive: true });
		const walUrl = target.baseUrl.replace(/\/+$/, "") + REMOTE_ADMIN_WAL_PATH;
		const walRes = await fetch(walUrl, {
			method: "GET",
			headers: { [REMOTE_AUTH_HEADER]: `Bearer ${target.password}` },
		});
		if (!walRes.ok) {
			const body = await walRes.text();
			const ui = cli("DB PULL", { frame: "error" });
			ui.kv(
				"error",
				`wal HTTP ${String(walRes.status)}: ${body.slice(0, 200).trim()}`,
				"info",
			);
			ui.kv("time", humanMs(performance.now() - wallStart), "muted");
			ui.kv("url", target.baseUrl, "muted");
			ui.end("error");
			process.exit(1);
		}
		const buf = new Uint8Array(await walRes.arrayBuffer());
		walPath = path.join(dataDir, "wal.log");
		writeFileSync(walPath, buf);
		walBytes = buf.byteLength;
	}

	const wallElapsed = performance.now() - wallStart;
	const schemaChanged = pulledChanged;
	const anyWork = schemaChanged || includeData;
	const frame: "success" | "noop" = anyWork ? "success" : "noop";
	const ui = cli("DB PULL", { frame });

	const deltaFirst =
		includeData && schemaChanged
			? `${String(tableNames.length)} tabelle · pulled.ts aggiornato · wal.log scaricato`
			: includeData
				? `wal.log scaricato (${humanBytes(walBytes)})`
				: schemaChanged
					? previous == null
						? `${String(tableNames.length)} tabelle · creato db/pulled.ts`
						: `${String(tableNames.length)} tabelle · aggiornato db/pulled.ts`
					: "nessun cambio al contenuto (solo header timestamp)";
	ui.kv("delta", deltaFirst, anyWork ? "ok" : "muted");

	ui.kv("time", humanMs(wallElapsed), anyWork ? "ok" : "muted");
	ui.kv("url", target.baseUrl, "muted");
	ui.kv("tables", String(tableNames.length), "muted");
	ui.kv("columns", String(nCols), "muted");
	ui.kv("size", humanBytes(Buffer.byteLength(ts, "utf8")), "muted");
	if (nSchemas > 0) ui.kv("schemas", String(nSchemas), "muted");
	else ui.kv("schemas", "0 (solo da db/index.ts locale)", "muted");

	if (schemaTree.length > 0) {
		ui.group("schemas", buildSchemaGroupRows(schemaTree, tableNames));
	}

	ui.kv("file", relPath(pulledPath), "muted");
	if (walPath != null) {
		ui.kv("wal", relPath(walPath), "muted");
		ui.kv("wal size", humanBytes(walBytes), "muted");
	}

	ui.muted("catalog.json locale non modificato — integra a mano in db/index.ts se serve");

	if (includeData || schemaChanged) {
		ui.end("pulled");
	} else {
		ui.end("noop", "INVARIATO");
	}
}

// ─── push-data ─────────────────────────────────────────────────────────────────
async function pushDataToRemote(alias: string): Promise<void> {
	const ui = cli("push-data", { alias, subtitle: "wal.log" });
	try {
		ui.step("risolvo alias");
		const target = await resolveAlias(alias);
		ui.line("url", target.baseUrl, "muted");

		const dataDir = process.env.FWDB_DATA?.trim() || path.join(root, FWDB_DEFAULT_DATA_REL_PATH);
		const walPath = path.join(dataDir, "wal.log");
		if (!existsSync(walPath)) {
			ui.err(`nessun wal.log in ${relPath(dataDir)}`);
			ui.end("error");
			process.exit(1);
		}
		const buf = readFileSync(walPath);
		ui.line("wal", relPath(walPath), "muted");
		ui.line("size", humanBytes(buf.byteLength));

		ui.warn("sovrascriverà il wal.log remoto — tutti i dati attuali verranno persi");
		ui.step("upload in corso");
		const url = target.baseUrl.replace(/\/+$/, "") + REMOTE_ADMIN_WAL_UPLOAD_PATH;
		const t0 = performance.now();
		const res = await fetch(url, {
			method: "POST",
			headers: {
				"content-type": "application/octet-stream",
				[REMOTE_AUTH_HEADER]: `Bearer ${target.password}`,
			},
			body: buf,
		});
		const text = await res.text();
		const dt = performance.now() - t0;
		if (!res.ok) {
			ui.err(`upload FAILED (${String(res.status)})`);
			ui.text(text.slice(0, 200));
			ui.end("error");
			process.exit(1);
		}
		ui.ok(`upload completato in ${humanMs(dt)}`);
		ui.warn("il server remoto va riavviato per rileggere il nuovo wal.log");
		ui.end("warning");
	} catch (e) {
		ui.err(e instanceof Error ? e.message : String(e));
		ui.end("error");
		process.exit(1);
	}
}

// ─── main ──────────────────────────────────────────────────────────────────────
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
			const ui = cli("pull", { subtitle: "missing alias" });
			ui.err("manca l'alias: usa `bun db pull --from <alias>`");
			ui.end("error");
			process.exit(1);
		}
		const includeData = flags.get("data") === true;
		await pullFromRemote(from, includeData);
		return;
	}
	if (cmd === "push-data") {
		const to = flags.get("to");
		if (typeof to !== "string" || !to) {
			const ui = cli("push-data", { subtitle: "missing alias" });
			ui.err("manca l'alias: usa `bun db push-data --to <alias>`");
			ui.end("error");
			process.exit(1);
		}
		await pushDataToRemote(to);
		return;
	}
	if (cmd === "ping") {
		const to = flags.get("to");
		if (typeof to !== "string" || !to) {
			const ui = cli("ping", { subtitle: "missing alias" });
			ui.err("manca l'alias: usa `bun db ping --to <alias>`");
			ui.end("error");
			process.exit(1);
		}
		const nRaw = flags.get("n");
		const n = typeof nRaw === "string" ? Math.max(1, Number.parseInt(nRaw, 10) || 5) : 5;
		const { runPing } = await import("./ping");
		await runPing(to, n);
		return;
	}

	// Help / usage
	usage("Gestione database locale e remoto", [
		{ cmd: "bun db push", desc: "scrive catalog.json locale dal bundle di db/index.ts" },
		{ cmd: "bun db push --to <alias>", desc: "invia catalog al remoto (hot reload, no restart)" },
		{ cmd: "bun db pull --from <alias>", desc: "scrive db/pulled.ts come reference TS" },
		{ cmd: "bun db pull --from <alias> --data", desc: "+ scarica anche wal.log" },
		{ cmd: "bun db push-data --to <alias>", desc: "upload wal.log al remoto (sovrascrive i dati)" },
		{ cmd: "bun db ping --to <alias> [--n N]", desc: "misura latenza di rete verso il remoto" },
	]);
	if (cmd) {
		process.stdout.write(`  ${colors.red}comando sconosciuto: ${cmd}${colors.reset}\n\n`);
	}
	process.exit(cmd ? 1 : 0);
}

await main();
