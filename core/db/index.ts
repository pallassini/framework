import appSchema, { type ServerTables } from "../../db/index";
import { CustomDb } from "./core";
import { createServerDbUtilities, type ServerDbUtilities } from "./server";

const customCore = new CustomDb<ServerTables>(
	appSchema.tableNames as readonly (keyof ServerTables & string)[],
	{
		dataDir: process.env.FWDB_DATA?.trim() || undefined,
		pkByTable: appSchema.pkByTable,
	},
);

/** Sempre `zig` (nessun fallback RAM). */
export const dbCustomBackend = customCore.mode;

export type Db = ServerDbUtilities<ServerTables>;

/** API tabellare su fwdb (Zig + persistenza in `FWDB_DATA` / `./data`). */
export const db: Db = createServerDbUtilities(
	customCore,
	appSchema.tableNames as readonly (keyof ServerTables & string)[],
);

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
export type { ServerDbUtilities } from "./server";
export type { ServerTables, User as DbUser, Work } from "../../db/index";
export {
	bundleTables,
	defineDb,
	defineSchema,
	defineTable,
	isFwTable,
	t,
	table,
	type CatalogJson,
	type Field,
	type FkDef,
	type FkField,
	type FwTable,
	type IndexDef,
	type StrField,
	type TableSchemaInput,
} from "./schema";
