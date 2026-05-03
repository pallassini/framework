import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import * as AppDb from "../../db/index";
import {
	collectModuleSchemas,
	collectModuleTableOrder,
	collectModuleTables,
	type ModuleExportRow,
	type SchemaNode,
} from "./collect";
import { CustomDb, resolveFwdbDataDir, type TablesMap } from "./core";
import { dbLog } from "./dev-log";
import { startDevDbSchemaWatch } from "./dev-schema-watch";
import { RemoteDb } from "./remote/client";
import { loadRemoteRegistry, resolveRemoteTarget } from "./remote/resolve";
import {
	createServerDbUtilities,
	syncDbTableShortcuts,
	type DbTableNames,
	type ServerDbUtilities,
} from "./server/utility";
import { bundleTables } from "./schema/table";
import { writeCatalogJsonToDisk } from "./schema/write-catalog-json-to-disk";

type AppDbExports = typeof AppDb;
type AppDbTableKey<K> = K extends string ? (K extends "default" | `_${string}` ? never : K) : never;
export type ServerTables = {
	[K in keyof AppDbExports as ModuleExportRow<AppDbExports[K]> extends never ? never : AppDbTableKey<K>]: ModuleExportRow<
		AppDbExports[K]
	>;
};

let liveBundle = bundleTables(collectModuleTables(AppDb as Record<string, unknown>));
/** Ultimo `db/index` visto (import statico all’avvio; dopo ogni HMR = modulo dinamico da `reloadDevDbSchema`). */
let liveDbIndexModule: Record<string, unknown> = AppDb as Record<string, unknown>;
let devSchemaReloadNotifier: (() => void) | undefined;

/** Processo desktop: callback eseguito dopo ogni `reloadDevDbSchema` con `{ ok: true }`. */
export function setDbDevSchemaReloadNotifier(fn: (() => void) | undefined): void {
	devSchemaReloadNotifier = fn;
}

const REMOTE_ALIAS = process.env.FWDB_REMOTE?.trim() || "";
/** True quando il processo corrente deve usare un DB remoto al posto del locale. */
export const FWDB_IS_REMOTE = REMOTE_ALIAS !== "";

const projectRoot = process.env.FRAMEWORK_PROJECT_ROOT?.trim() || process.cwd();

/** Core: locale (CustomDb/Zig) oppure client (RemoteDb) — stessa API pubblica. */
type AnyCore = CustomDb<ServerTables> | RemoteDb<ServerTables>;

let customCore: AnyCore;
let localCore: CustomDb<ServerTables> | null = null;
let dataDirResolved = "";

if (FWDB_IS_REMOTE) {
	const registry = await loadRemoteRegistry(projectRoot);
	const target = resolveRemoteTarget(REMOTE_ALIAS, registry);
	const remoteDb = new RemoteDb<ServerTables>(target);
	customCore = remoteDb;
	dbLog("boot", "init", "bundle iniziale da db/index (client remoto)", {
		tableNames: [...liveBundle.tableNames],
		dataDir: remoteDb.dataDir,
		nodeEnv: process.env.NODE_ENV ?? "",
		remoteAlias: REMOTE_ALIAS,
		remoteUrl: target.baseUrl,
	});
} else {
	dataDirResolved = resolveFwdbDataDir({
		dataDir: process.env.FWDB_DATA?.trim() || undefined,
	});
	writeCatalogJsonToDisk(dataDirResolved, liveBundle.catalog);

	localCore = new CustomDb<ServerTables>(
		liveBundle.tableNames as readonly (keyof ServerTables & string)[],
		{
			dataDir: dataDirResolved,
			pkByTable: liveBundle.pkByTable,
			catalog: liveBundle.catalog,
		},
	);
	customCore = localCore;

	dbLog("boot", "init", "bundle iniziale da db/index (import statico)", {
		tableNames: [...liveBundle.tableNames],
		dataDir: localCore.dataDir,
		nodeEnv: process.env.NODE_ENV ?? "",
	});
}

/** Backend attivo: `"zig"` (locale) o `"remote"` (client HTTP verso un server remoto). */
export const dbCustomBackend = customCore.mode;

/** Info descrittive sul backend attivo (utile per devtools / pagine admin). */
export type DbBackendInfo =
	| { mode: "zig"; dataDir: string }
	| { mode: "remote"; alias: string; baseUrl: string };

export function getDbBackendInfo(): DbBackendInfo {
	if (customCore.mode === "remote") {
		const rc = customCore as RemoteDb<ServerTables>;
		const info = rc.backendInfo;
		return { mode: "remote", alias: info.alias, baseUrl: info.baseUrl };
	}
	return { mode: "zig", dataDir: (customCore as CustomDb<ServerTables>).dataDir };
}

export type Db = ServerDbUtilities<ServerTables>;
export type db = Db;
export type DbTables = Db["tables"];
export type DbTable = DbTableNames<Db>;

/** API tabellare su fwdb (Zig + persistenza in `FWDB_DATA` / `core/db/data`) o su client remoto se `FWDB_REMOTE` è settato. */
export const db: Db = createServerDbUtilities(
	customCore as CustomDb<ServerTables>,
	() => liveBundle.tableNames as readonly (keyof ServerTables & string)[],
	() => liveBundle,
);

/** Accessor live: le FwTables del bundle corrente (aggiornate ad ogni HMR schema). */
export function getLiveFwTables() {
	return liveBundle.fwTables;
}

function requireLocalCore(): CustomDb<ServerTables> {
	if (!localCore) {
		throw new Error(
			"[db/admin] operazioni admin locali non disponibili: il processo gira in modalità remote (FWDB_REMOTE settato).",
		);
	}
	return localCore;
}

/**
 * Admin: applica un `catalog.json` ricevuto (es. da `bun db push` remoto).
 * Scrive su disco in `dataDir`, riapre il motore Zig, aggiorna `fkMap`.
 * NON aggiorna i tipi TS di `ServerTables` (quelli sono statici dal boot);
 * le API runtime (`db.table(...)`) funzionano comunque perché operano su stringhe.
 * Richiede il core locale (errore se il processo è client-remote).
 */
export function applyCatalogJsonString(jsonString: string): { tableNames: string[] } {
	const local = requireLocalCore();
	const parsed = JSON.parse(jsonString) as { tables?: Record<string, { pk?: string }> };
	if (!parsed || typeof parsed !== "object" || !parsed.tables || typeof parsed.tables !== "object") {
		throw new Error("[db/admin] catalog non valido: manca `tables`");
	}
	const tableNames = Object.keys(parsed.tables);
	const pkByTable = Object.fromEntries(tableNames.map((n) => [n, parsed.tables![n]?.pk ?? "id"]));

	mkdirSync(local.dataDir, { recursive: true });
	writeFileSync(join(local.dataDir, "catalog.json"), `${JSON.stringify(parsed)}\n`);

	local.reloadAfterCatalogWrite(
		tableNames,
		pkByTable,
		parsed as unknown as import("./schema/defineSchema").CatalogJson,
	);
	return { tableNames };
}

/** Admin: legge il `catalog.json` corrente dal disco (solo lato server locale). */
export function readCurrentCatalogJsonString(): string {
	const local = requireLocalCore();
	const p = join(local.dataDir, "catalog.json");
	return readFileSync(p, "utf8");
}

/** Admin: forza checkpoint del WAL (per pull consistente del `wal.log`). Solo locale. */
export function forceCheckpoint(): void {
	const local = requireLocalCore();
	local.checkpoint();
}

/** Admin: path della directory dati (per stream del `wal.log`). Solo locale. */
export function getDataDir(): string {
	const local = requireLocalCore();
	return local.dataDir;
}

/**
 * Accessor live: l'albero degli `schema(...)` dichiarati in `db/index.ts`.
 * Usa `liveDbIndexModule` (aggiornato ad ogni reload HMR riuscito), non l'import statico `AppDb`.
 */
export function getLiveDbSchemaTree(): readonly SchemaNode[] {
	return collectModuleSchemas(liveDbIndexModule).tree;
}

/**
 * Ordine dichiarazione dei table-export in `db/index.ts` (live, segue l'HMR).
 * Usato dai devtools per mostrare tabelle e colonne come sono scritte nel file.
 */
export function getLiveDbTableOrder(): readonly string[] {
	return collectModuleTableOrder(liveDbIndexModule);
}

if (
	typeof process !== "undefined" &&
	process.env.NODE_ENV !== "production" &&
	!FWDB_IS_REMOTE &&
	localCore !== null
) {
	startDevDbSchemaWatch(projectRoot, {
		core: localCore as CustomDb<TablesMap>,
		applyBundle: (next) => {
			liveBundle = next;
			syncDbTableShortcuts(db);
		},
		onDbIndexModule: (mod) => {
			liveDbIndexModule = mod;
		},
		onReloaded: () => {
			const fn = devSchemaReloadNotifier;
			if (!fn) return false;
			try {
				fn();
			} catch (e) {
				console.error("[db/dev] notifier:", e);
			}
			return true;
		},
	});
}

export type {
	CountOpts,
	CustomDbOpenOptions,
	DbRow,
	DbScalar,
	DeleteOpts,
	DeleteResult,
	FindOpts,
	FindOptions,
	OneOrMany,
	Projected,
	TableAccessor,
	TxApi,
	UpdateOpts,
	UpdatePatch,
	UpdateResult,
	Where,
	WhereOps,
	WhereValue,
} from "./core";
export { deletedAtLive, notNull, FWDB_DEFAULT_DATA_REL_PATH, resolveFwdbDataDir } from "./core";
export type { DbTableNames, ServerDbUtilities } from "./server";
export type User = ServerTables["users"];
export type DbUser = User;
export { dbConfig, type DbLogConfig } from "../../db/config";
export { tables, type PlainSchema } from "./plain";
export {
	bundle,
	bundleTables,
	defineDb,
	defineSchema,
	defineTable,
	fk,
	flattenSchemaTables,
	FW_SCHEMA,
	isFwSchema,
	isFwTable,
	isTableBuilder,
	ref,
	REF,
	schema,
	t,
	table,
	TABLE_BUILDER,
	type AppDbTableName,
	type Bundled,
	type CatalogJson,
	type DbBundleSchema,
	type Field,
	type FullRow,
	type FkDef,
	type FkField,
	type FwSchema,
	type FwSchemaChild,
	type FwTable,
	type IndexDef,
	type RefMeta,
	type StrField,
	type TableBuilder,
	type TableSchemaInput,
} from "./schema";
export type { SchemaNode } from "./collect";
