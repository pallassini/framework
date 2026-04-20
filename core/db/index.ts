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
import {
	createServerDbUtilities,
	syncDbTableShortcuts,
	type DbTableNames,
	type ServerDbUtilities,
} from "./server/utility";
import { bundleTables } from "./schema/table";

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

const dataDirResolved = resolveFwdbDataDir({
	dataDir: process.env.FWDB_DATA?.trim() || undefined,
});
liveBundle.writeCatalogSync(dataDirResolved);

const customCore = new CustomDb<ServerTables>(
	liveBundle.tableNames as readonly (keyof ServerTables & string)[],
	{
		dataDir: dataDirResolved,
		pkByTable: liveBundle.pkByTable,
		catalog: liveBundle.catalog,
	},
);

dbLog("boot", "init", "bundle iniziale da db/index (import statico)", {
	tableNames: [...liveBundle.tableNames],
	dataDir: customCore.dataDir,
	nodeEnv: process.env.NODE_ENV ?? "",
});

/** Sempre `zig` (nessun fallback RAM). */
export const dbCustomBackend = customCore.mode;

export type Db = ServerDbUtilities<ServerTables>;
export type db = Db;
export type DbTables = Db["tables"];
export type DbTable = DbTableNames<Db>;

/** API tabellare su fwdb (Zig + persistenza in `FWDB_DATA` / `core/db/data`). */
export const db: Db = createServerDbUtilities(
	customCore,
	() => liveBundle.tableNames as readonly (keyof ServerTables & string)[],
	() => liveBundle,
);

/** Accessor live: le FwTables del bundle corrente (aggiornate ad ogni HMR schema). */
export function getLiveFwTables() {
	return liveBundle.fwTables;
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

const projectRoot = process.env.FRAMEWORK_PROJECT_ROOT?.trim() || process.cwd();
if (typeof process !== "undefined" && process.env.NODE_ENV !== "production") {
	startDevDbSchemaWatch(projectRoot, {
		core: customCore as CustomDb<TablesMap>,
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
export { FWDB_DEFAULT_DATA_REL_PATH, resolveFwdbDataDir } from "./core";
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
