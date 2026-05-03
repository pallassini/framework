/**
 * Reload schema in dev: **solo processi Bun Node** (stdout/stderr di quel processo), mai il browser Vite.
 *
 * | `proc` in log | Processo tipico |
 * |---------------|-------------------|
 * | `rpc`         | child HTTP `bun …/serve.ts` (`FWDB_DEV_RPC_CHILD=1`) |
 * | `host`        | Electrodun / altro Bun che importa `core/db` |
 *
 * `dbLog` → `console` del processo corrente (vedi `db/config.ts` per attivare/disattivare).
 * `[db/trace]` → solo con `FWDB_DEV_SCHEMA_RELOAD_TRACE=1` (stesso processo).
 * Watchdog import → `console.warn` solo se **non** c’è timeout su `import()` (default 7s; `FWDB_SCHEMA_IMPORT_WATCHDOG_MS=0` off).
 *
 * Timeout `import()`: `FWDB_SCHEMA_IMPORT_TIMEOUT_MS` — se non impostato, nel child **RPC** default **15s**
 * (workaround Bun: dopo un import respinto, il successivo può restare appeso senza timeout). `=0` disabilita.
 *
 * Preflight: prima di `import()` dinamico, `Bun.build` su `db/index.ts` in una cartella temporanea.
 * Se il bundle non compila → si ignora il reload (nessun `import`, nessun tocco a catalog/Zig). Disabilita: `FWDB_DEV_SCHEMA_PREFLIGHT=0`.
 */
import { existsSync, mkdirSync, mkdtempSync, rmSync, watch, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { uncacheModulesUnderDir } from "../server/routes/module-cache";
import { collectModuleTables } from "./collect";
import { dbLog } from "./dev-log";
import type { CustomDb, TablesMap } from "./core/customDb";
import { bundleTables, type DbBundleSchema } from "./schema/table";
import { writeCatalogJsonToDisk } from "./schema/write-catalog-json-to-disk";

export type DbDevReloadContext = {
	core: CustomDb<TablesMap>;
	applyBundle: (next: DbBundleSchema) => void;
	/**
	 * Dopo un reload riuscito: export map di `db/index.ts` appena importata (HMR).
	 * Serve perché `import * as AppDb` nel bundle core resta il modulo iniziale; schemi / ordine export vanno letti da qui.
	 */
	onDbIndexModule?: (mod: Record<string, unknown>) => void;
	/** true se ha notificato almeno una UI; false/void se non c'è alcun subscriber nel processo. */
	onReloaded?: () => boolean | void;
};

let lastWatchCtx: DbDevReloadContext | undefined;
let lastWatchProjectRoot: string | undefined;

/** Solo processo Electrodun: per fan-out da file dopo reload nel processo RPC. */
export function getLastDevDbSchemaWatchRegistration():
	| { ctx: DbDevReloadContext; projectRoot: string }
	| undefined {
	if (!lastWatchCtx || !lastWatchProjectRoot) return undefined;
	return { ctx: lastWatchCtx, projectRoot: lastWatchProjectRoot };
}

function touchCrossProcessDbReloadSignal(projectRoot: string): boolean {
	try {
		const dir = path.join(projectRoot, "core", "desktop", ".dev");
		mkdirSync(dir, { recursive: true });
		writeFileSync(path.join(dir, "db-schema-reload"), `${Date.now()}\n`, "utf8");
		return true;
	} catch {
		return false;
	}
}

export type ReloadDevDbSchemaOptions = { /** true se la richiesta arriva dal file fan-out (evita ping-pong). */
	fanout?: boolean;
};

export type ReloadDevDbSchemaResult = { ok: true } | { ok: false; error: string };

function fmtReloadErr(e: unknown): string {
	return e instanceof Error ? e.message : String(e);
}

/**
 * Verifica che `db/index.ts` (e dipendenze) bundlino senza errori **senza** eseguire `import()` dinamico.
 * @returns `null` se ok; `{ ok: false, error }` se da ignorare.
 */
async function preflightDbIndexBundle(
	projectRoot: string,
	dbIndexAbs: string,
	flushId?: number,
	flushIter?: number,
): Promise<ReloadDevDbSchemaResult | null> {
	if (process.env.FWDB_DEV_SCHEMA_PREFLIGHT?.trim() === "0") return null;

	let outdir: string | undefined;
	try {
		outdir = mkdtempSync(path.join(tmpdir(), "fwdb-schema-pf-"));
		traceSchema("preflight:Bun.build start", { flushId, flushIter, outdir, dbIndexAbs });
		const result = await Bun.build({
			root: projectRoot,
			entrypoints: [dbIndexAbs],
			outdir,
			target: "bun",
			minify: false,
			sourcemap: "none",
		});
		traceSchema("preflight:Bun.build end", { flushId, flushIter, success: result.success });
		if (result.success) return null;

		const detail = (result.logs ?? [])
			.map((l) => {
				const o = l as { message?: string; kind?: string };
				if (typeof o.message === "string") return o.message;
				return String(l);
			})
			.join("\n");
		const error =
			detail.trim().length > 0 ? (detail.length > 4000 ? `${detail.slice(0, 4000)}…` : detail) : "Bun.build fallito (nessun log)";

		dbLog("schemaReload", "reload", "tentativo ignorato: db/index.ts non passa il controllo bundle — nessuna modifica", {
			...schemaReloadProcFields(),
			hint: "Nessun import dinamico né aggiornamento catalog/Zig; correggi gli errori di compilazione",
			err: error.split("\n")[0] ?? error,
			errDetail: error,
			flushId,
			flushIter,
		});
		return { ok: false, error: error.split("\n")[0] ?? error };
	} catch (e) {
		const error = fmtReloadErr(e);
		dbLog("schemaReload", "reload", "tentativo ignorato: controllo bundle (Bun.build) eccezione — nessuna modifica", {
			...schemaReloadProcFields(),
			hint: "Nessun import dinamico né aggiornamento catalog/Zig",
			err: error,
			flushId,
			flushIter,
		});
		return { ok: false, error };
	} finally {
		if (outdir) {
			try {
				rmSync(outdir, { recursive: true, force: true });
			} catch {
				/* */
			}
		}
	}
}

/** Stessa coda del watcher su `db/`: evita reload paralleli (fanout vs fs) che possono “bloccare” dopo errori. */
let schemaReloadDebounce: ReturnType<typeof setTimeout> | undefined;
let schemaReloadRunning = false;
let schemaReloadQueued = false;
let schemaReloadPendingFanout = false;
let schemaFsWatchInstalled = false;
let lastReloadFailed = false;
let lastReloadError = "";
let schemaReloadSeq = 0;
/** Dopo `import(db/index)` fallito: breve pausa prima del prossimo tentativo (mitiga hang Bun nel child RPC). */
let needsCooldownAfterDbIndexImportFail = false;

async function sleepMs(ms: number): Promise<void> {
	if (typeof Bun !== "undefined" && typeof Bun.sleep === "function") {
		await Bun.sleep(ms);
	} else {
		await new Promise<void>((r) => setTimeout(r, ms));
	}
}

function schemaReloadVerbose(): boolean {
	return process.env.FWDB_DEV_SCHEMA_RELOAD_VERBOSE?.trim() === "1";
}

/** Log passo-passo: `FWDB_DEV_SCHEMA_RELOAD_TRACE=1` (stdout del processo Bun che fa reload). */
function schemaReloadTrace(): boolean {
	return process.env.FWDB_DEV_SCHEMA_RELOAD_TRACE?.trim() === "1";
}

/** Dove sta girando questo `reloadDevDbSchema` (per capire i log quando RPC + desktop mescolano il terminale). */
function schemaReloadProcessRole(): "rpc" | "host" {
	return process.env.FWDB_DEV_RPC_CHILD === "1" ? "rpc" : "host";
}

function schemaReloadProcFields(): { proc: "rpc" | "host" } {
	return { proc: schemaReloadProcessRole() };
}

function traceSchema(step: string, extra?: Record<string, unknown>): void {
	if (!schemaReloadTrace()) return;
	console.log("[db/trace]", schemaReloadProcessRole(), step, { pid: process.pid, ...extra });
}

/** Dopo quanti ms segnalare che `import(db/index)` non è ancora tornato (0 = disattivo). Default 7000. */
function readImportWatchdogMs(): number {
	const raw = process.env.FWDB_SCHEMA_IMPORT_WATCHDOG_MS?.trim();
	if (raw === "0") return 0;
	const n = Number(raw);
	if (Number.isFinite(n) && n > 0) return n;
	return 7000;
}

function bumpSchemaReloadDebounce(fromFanout: boolean): void {
	if (fromFanout) schemaReloadPendingFanout = true;
	if (schemaReloadRunning) {
		schemaReloadQueued = true;
		if (schemaReloadVerbose()) {
			console.log("[db/dev] bump: in-flight → queued", {
				fromFanout,
				pendingFanout: schemaReloadPendingFanout,
			});
		}
		return;
	}
	if (schemaReloadDebounce != null) clearTimeout(schemaReloadDebounce);
	if (schemaReloadVerbose()) {
		console.log("[db/dev] bump: debounce 200ms", { fromFanout, pendingFanout: schemaReloadPendingFanout });
	}
	schemaReloadDebounce = setTimeout(() => {
		schemaReloadDebounce = undefined;
		traceSchema("debounce:200ms scaduto → avvio runSchemaReloadFlush", {
			queued: schemaReloadQueued,
			pendingFanout: schemaReloadPendingFanout,
			running: schemaReloadRunning,
		});
		void runSchemaReloadFlush();
	}, 200);
}

/**
 * Electrodun: dopo `db-schema-reload` scritto dal processo RPC; non chiamare `reloadDevDbSchema` direttamente.
 */
export function scheduleDevDbSchemaFanoutFromDesktop(): void {
	bumpSchemaReloadDebounce(true);
}

async function runSchemaReloadFlush(): Promise<void> {
	if (schemaReloadRunning) {
		schemaReloadQueued = true;
		traceSchema("flush:ingresso ma running=true → solo queue", {
			queued: true,
			pendingFanout: schemaReloadPendingFanout,
		});
		if (schemaReloadVerbose()) {
			console.log("[db/dev] flush: skipped (already running) → queued");
		}
		return;
	}
	schemaReloadRunning = true;
	const flushId = ++schemaReloadSeq;
	traceSchema("flush:start", { flushId, rpcChild: process.env.FWDB_DEV_RPC_CHILD === "1" });
	if (schemaReloadVerbose()) {
		console.log("[db/dev] flush: start", { flushId, rpcChild: process.env.FWDB_DEV_RPC_CHILD === "1" });
	}
	try {
		let iter = 0;
		do {
			iter++;
			schemaReloadQueued = false;
			const opts = schemaReloadPendingFanout ? { fanout: true } : undefined;
			schemaReloadPendingFanout = false;
			if (!lastWatchCtx || !lastWatchProjectRoot) {
				console.error("[db/dev] flush: nessun ctx/projectRoot registrato — interrompo coda", { flushId, iter });
				traceSchema("flush:break-no-ctx", { flushId, iter });
				break;
			}
			if (schemaReloadVerbose()) {
				console.log("[db/dev] flush: iterazione", {
					flushId,
					iter,
					opts,
					queuedAfter: schemaReloadQueued,
					pendingFanoutAfterClear: schemaReloadPendingFanout,
				});
			}
			traceSchema("flush:before-reloadDevDbSchema", { flushId, iter, opts });
			const hadFailed = lastReloadFailed;
			const r = await reloadDevDbSchema(lastWatchCtx, lastWatchProjectRoot, opts, flushId, iter);
			traceSchema("flush:after-reloadDevDbSchema", {
				flushId,
				iter,
				ok: r.ok,
				err: r.ok ? undefined : r.error,
			});
			if (!r.ok) {
				lastReloadFailed = true;
				lastReloadError = r.error;
			} else {
				if (hadFailed) {
					dbLog("schemaReload", "reload", "ripresa dopo errore schema precedente", {
						...schemaReloadProcFields(),
						prevErr: lastReloadError,
					});
				}
				lastReloadFailed = false;
				lastReloadError = "";
			}
			traceSchema("flush:iter-end", {
				flushId,
				iter,
				loopAgain: schemaReloadQueued || schemaReloadPendingFanout,
				queued: schemaReloadQueued,
				pendingFanout: schemaReloadPendingFanout,
			});
		} while (schemaReloadQueued || schemaReloadPendingFanout);
		if (schemaReloadVerbose()) {
			console.log("[db/dev] flush: done", { flushId, lastOk: !lastReloadFailed });
		}
		traceSchema("flush:do-while-exit", { flushId, lastReloadFailed });
	} finally {
		schemaReloadRunning = false;
		traceSchema("flush:finally running=false", {
			flushId,
			willReRun: schemaReloadQueued || schemaReloadPendingFanout,
			queued: schemaReloadQueued,
			pendingFanout: schemaReloadPendingFanout,
		});
		if (schemaReloadQueued || schemaReloadPendingFanout) {
			if (schemaReloadVerbose()) {
				console.log("[db/dev] flush: finally → re-run", {
					flushId,
					queued: schemaReloadQueued,
					pendingFanout: schemaReloadPendingFanout,
				});
			}
			traceSchema("flush:schedule-reentrant-runSchemaReloadFlush", { flushId });
			void runSchemaReloadFlush();
		}
	}
}

function readImportTimeoutMs(): number {
	const raw = process.env.FWDB_SCHEMA_IMPORT_TIMEOUT_MS?.trim();
	if (raw === "0") return 0;
	const n = Number(raw);
	if (Number.isFinite(n) && n > 0) return n;
	/** Sul child RPC Bun può appendere dopo un import respinto: default 15s per sbloccare la coda. */
	if (process.env.FWDB_DEV_RPC_CHILD === "1") return 15_000;
	return 0;
}

type ImportTraceCtx = { flushId?: number; flushIter?: number };

async function importDbIndexModule(href: string, ctx: ImportTraceCtx = {}): Promise<Record<string, unknown>> {
	const importT0 = Date.now();
	traceSchema("import:enter", { ...ctx, hrefLen: href.length, hrefTail: href.slice(-96) });

	const importTimeoutMs = readImportTimeoutMs();
	/** Con timeout su `import()` il watchdog è ridondante e confonde i log. */
	const wdMs = importTimeoutMs > 0 ? 0 : readImportWatchdogMs();
	let watchdog: ReturnType<typeof setTimeout> | undefined;
	if (wdMs > 0) {
		watchdog = setTimeout(() => {
			console.warn("[db] import watchdog: `import(db/index)` ancora in sospeso (possibile hang Bun)", {
				proc: schemaReloadProcessRole(),
				pid: process.pid,
				waitedMs: wdMs,
				...ctx,
				elapsedSinceEnter: Date.now() - importT0,
			});
		}, wdMs);
	}

	let tick: ReturnType<typeof setInterval> | undefined;
	if (schemaReloadTrace()) {
		tick = setInterval(() => {
			traceSchema("import:tick ancora-await", {
				...ctx,
				elapsedMs: Date.now() - importT0,
			});
		}, 2000);
	}

	try {
		if (importTimeoutMs <= 0) {
			traceSchema("import:await-import (no Promise.race timeout)", ctx);
			const mod = (await import(href)) as Record<string, unknown>;
			traceSchema("import:ok", { ...ctx, elapsedMs: Date.now() - importT0 });
			return mod;
		}
		let to: ReturnType<typeof setTimeout> | undefined;
		const timeout = new Promise<never>((_, rej) => {
			to = setTimeout(
				() =>
					rej(
						new Error(
							`[db] import db/index timeout ${importTimeoutMs}ms (coda sbloccata; FWDB_SCHEMA_IMPORT_TIMEOUT_MS=0 disabilita)`,
						),
					),
				importTimeoutMs,
			);
		});
		try {
			traceSchema("import:await-import (Promise.race)", { ...ctx, timeoutMs: importTimeoutMs });
			const out = (await Promise.race([
				import(href) as Promise<Record<string, unknown>>,
				timeout,
			])) as Record<string, unknown>;
			traceSchema("import:ok", { ...ctx, elapsedMs: Date.now() - importT0 });
			return out;
		} finally {
			if (to != null) clearTimeout(to);
		}
	} catch (e) {
		traceSchema("import:reject", { ...ctx, err: fmtReloadErr(e), elapsedMs: Date.now() - importT0 });
		throw e;
	} finally {
		if (watchdog != null) clearTimeout(watchdog);
		if (tick != null) clearInterval(tick);
		traceSchema("import:leave-finally", { ...ctx, elapsedMs: Date.now() - importT0 });
	}
}

/**
 * Ricarica `db/index.ts` in dev.
 * Fase 1: import + `bundleTables` (solo memoria) — se fallisce, **non** si tocca catalog né Zig né `applyBundle`.
 * Fase 2: scrittura catalog, riapertura Zig, aggiornamento bundle TS — solo se la fase 1 è ok.
 */
export async function reloadDevDbSchema(
	ctx: DbDevReloadContext,
	projectRoot: string,
	opts?: ReloadDevDbSchemaOptions,
	flushId?: number,
	flushIter?: number,
): Promise<ReloadDevDbSchemaResult> {
	const dbDir = path.join(projectRoot, "db");
	const file = path.join(dbDir, "index.ts");
	if (needsCooldownAfterDbIndexImportFail) {
		needsCooldownAfterDbIndexImportFail = false;
		traceSchema("reload:cooldown 400ms dopo import(db/index) fallito", { flushId, flushIter });
		await sleepMs(400);
	}

	const pre = await preflightDbIndexBundle(projectRoot, file, flushId, flushIter);
	if (pre != null) {
		return pre;
	}

	uncacheModulesUnderDir(dbDir);
	const href = `${pathToFileURL(file).href}?t=${Date.now()}&fwDbSchemaReload=1`;
	const t0 = Date.now();
	dbLog("schemaReload", "reload", "inizio import db/index.ts + bundle", {
		...schemaReloadProcFields(),
		projectRoot,
		dbIndex: file,
		dataDir: ctx.core.dataDir,
		flushId,
		flushIter,
		importTimeoutMs: readImportTimeoutMs(),
	});
	if (schemaReloadVerbose()) {
		const keys = Object.keys(require.cache as Record<string, unknown>).filter((k) => /[/\\]db[/\\]/i.test(k));
		console.log("[db/dev] pre-import: require.cache keys in db/", { count: keys.length, sample: keys.slice(0, 12) });
	}
	traceSchema("reload:uncache fatto, pre-import", { flushId, flushIter });

	/** Fase 1 — nessun effetto su disco Zig finché non abbiamo un bundle valido. */
	let mod: Record<string, unknown>;
	try {
		mod = await importDbIndexModule(href, { flushId, flushIter });
	} catch (e) {
		needsCooldownAfterDbIndexImportFail = true;
		const error = fmtReloadErr(e);
		if (schemaReloadVerbose()) {
			console.error("[db/dev] dettaglio import (solo FWDB_DEV_SCHEMA_RELOAD_VERBOSE=1):\n", e);
		}
		dbLog("schemaReload", "reload", "tentativo ignorato: db/index.ts non compilabile — nessuna modifica", {
			...schemaReloadProcFields(),
			hint: "catalog, Zig e API TS restano sull'ultimo schema valido; nessun refresh UI da questo tentativo",
			err: error,
			flushId,
			flushIter,
		});
		return { ok: false, error };
	}
	if (schemaReloadVerbose()) {
		console.log("[db/dev] post-import ok", { ms: Date.now() - t0 });
	}
	traceSchema("reload:post-import, pre-bundleTables", { flushId, flushIter, ms: Date.now() - t0 });

	let next: ReturnType<typeof bundleTables>;
	try {
		next = bundleTables(collectModuleTables(mod));
	} catch (e) {
		const error = fmtReloadErr(e);
		if (schemaReloadVerbose()) {
			console.error("[db/dev] dettaglio bundle (solo VERBOSE=1):\n", e);
		}
		dbLog("schemaReload", "reload", "tentativo ignorato: bundle schema non valido — nessuna modifica", {
			...schemaReloadProcFields(),
			hint: "catalog, Zig e API TS restano sull'ultimo schema valido",
			err: error,
			flushId,
			flushIter,
		});
		return { ok: false, error };
	}
	traceSchema("reload:post-bundle, pre-fase2-disk+zig", { flushId, flushIter, tableNames: [...next.tableNames] });

	/** Fase 2 — applicazione atomica lato processo (dopo questo, TS + Zig allineati al nuovo catalog). */
	try {
		traceSchema("reload:fase2 writeCatalogSync", { flushId, flushIter });
		writeCatalogJsonToDisk(ctx.core.dataDir, next.catalog);
		traceSchema("reload:fase2 reloadAfterCatalogWrite", { flushId, flushIter });
		ctx.core.reloadAfterCatalogWrite(next.tableNames, next.pkByTable, next.catalog);
		traceSchema("reload:fase2 applyBundle", { flushId, flushIter });
		ctx.applyBundle(next);
		ctx.onDbIndexModule?.(mod);
		traceSchema("reload:fase2 ok", { flushId, flushIter });
	} catch (e) {
		const error = fmtReloadErr(e);
		dbLog("schemaReload", "reload", "errore applicando catalog/Zig dopo schema valido — stato incerto", {
			...schemaReloadProcFields(),
			err: error,
		});
		console.error("[db/dev] ricarica schema: applicazione catalog/Zig fallita\n", e);
		return { ok: false, error };
	}

	const ms = Date.now() - t0;
	const exportKeys = Object.keys(mod)
		.filter((k) => k !== "default" && !k.startsWith("_"))
		.sort();
	dbLog("schemaReload", "reload", "ok: catalog scritto, Zig riaperto, bundle applicato", {
		...schemaReloadProcFields(),
		ms,
		tableNames: [...next.tableNames],
		catalogTables: Object.keys(next.catalog.tables).sort(),
		moduleExportKeys: exportKeys,
		dataDir: ctx.core.dataDir,
		hasOnReloaded: ctx.onReloaded != null,
		fromFanout: opts?.fanout === true,
	});
	let notified = false;
	try {
		notified = ctx.onReloaded?.() === true;
	} catch (e) {
		console.error("[db/dev] onReloaded:", e);
	}
	const isRpcDevChild = process.env.FWDB_DEV_RPC_CHILD === "1";
	/** Solo il processo RPC (`bun serve`): senza BrowserView, tocca il file così Electrodun rifà reload + notifier. */
	if (!opts?.fanout && !notified && isRpcDevChild) {
		traceSchema("reload:touch fanout token (RPC)", { flushId, flushIter });
		const touched = touchCrossProcessDbReloadSignal(projectRoot);
		dbLog("schemaReload", "fanout", "segnale cross-process db-schema-reload", {
			...schemaReloadProcFields(),
			touched,
			notified,
			isRpcDevChild,
		});
	}
	traceSchema("reload:return ok", { flushId, flushIter, totalMs: Date.now() - t0 });
	return { ok: true };
}

/**
 * In dev: ogni salvataggio sotto `db/` → ricarica `db/index.ts`, riscrive `catalog.json`, riapre Zig.
 * Su VPS/prod non parte (`NODE_ENV === "production"` o `FWDB_DEV_SCHEMA_WATCH=0`).
 */
export function startDevDbSchemaWatch(projectRoot: string, ctx: DbDevReloadContext): void {
	if (process.env.NODE_ENV === "production") return;
	if (process.env.FWDB_DEV_SCHEMA_WATCH?.trim() === "0") return;

	lastWatchCtx = ctx;
	lastWatchProjectRoot = projectRoot;

	const dbDir = path.join(projectRoot, "db");
	const dbIndex = path.join(dbDir, "index.ts");

	if (schemaFsWatchInstalled) return;

	try {
		if (existsSync(dbDir)) {
			watch(dbDir, { recursive: true }, () => bumpSchemaReloadDebounce(false));
		} else if (existsSync(dbIndex)) {
			watch(dbIndex, () => bumpSchemaReloadDebounce(false));
		} else {
			return;
		}
	} catch {
		if (existsSync(dbIndex)) watch(dbIndex, () => bumpSchemaReloadDebounce(false));
		else return;
	}

	schemaFsWatchInstalled = true;

	dbLog(
		"schemaWatch",
		"watch",
		"attivo: salvataggi in db/ → import db/index + catalog + Zig (nessun db push)",
		{ ...schemaReloadProcFields(), dbDir, dbIndex },
	);
}
