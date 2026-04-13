import { CustomDb } from "./core";
import { createServerDbUtilities, type ServerDbUtilities, type ServerTables } from "./server";

const customCore = new CustomDb<ServerTables>(["users"]);
const customUtils = createServerDbUtilities(customCore, ["users"]);

/** `zig` se `zig-out/bin/fwdb` è caricato, altrimenti `memory`. */
export const dbCustomBackend = customCore.mode;

export type Db = ServerDbUtilities<ServerTables>;

/** API tabellare custom (fwdb / RAM): `db.users.*`, ecc. Nessun Postgres. */
export const db: Db = customUtils;

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
export type { DbUser, ServerDbUtilities, ServerTables } from "./server";
export {
	defineSchema,
	table,
	type CatalogJson,
	type FkDef,
	type IndexDef,
	type TableSchemaInput,
} from "./schema";
