import * as AppDb from "../../db/index";
import { collectModuleTables, type ModuleExportRow } from "./collect";
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

const projectRoot = process.env.FRAMEWORK_PROJECT_ROOT?.trim() || process.cwd();
if (typeof process !== "undefined" && process.env.NODE_ENV !== "production") {
	startDevDbSchemaWatch(projectRoot, {
		core: customCore as CustomDb<TablesMap>,
		applyBundle: (next) => {
			liveBundle = next;
			syncDbTableShortcuts(db);
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
	CustomDbOpenOptions,
	DbRow,
	DbScalar,
	DeleteResult,
	FindOptions,
	OneOrMany,
	TableAccessor,
	UpdatePatch,
	UpdateResult,
	Where,
	WhereOps,
	WhereValue,
} from "./core";
export { FWDB_DEFAULT_DATA_REL_PATH, resolveFwdbDataDir } from "./core";
export type { DbTableNames, ServerDbUtilities } from "./server";
export type User = ServerTables["users"];
export type Work = ServerTables["works"];
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
	isFwTable,
	isTableBuilder,
	ref,
	REF,
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
	type FwTable,
	type IndexDef,
	type RefMeta,
	type StrField,
	type TableBuilder,
	type TableSchemaInput,
} from "./schema";
