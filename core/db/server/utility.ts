import { CustomDb, type TablesMap } from "../core/customDb";
import type { TableAccessor } from "../core/types";
import type { ServerTables } from "../../../db/index";

export type { ServerTables };

type Accessors<Tables extends TablesMap> = {
	[K in keyof Tables & string]: TableAccessor<Tables[K]>;
};

export type ServerDbUtilities<Tables extends TablesMap = ServerTables> = {
	table<K extends keyof Tables & string>(name: K): TableAccessor<Tables[K]>;
	clearAll(): Promise<number>;
} & Accessors<Tables>;

export function createServerDbUtilities<Tables extends TablesMap>(
	db: CustomDb<Tables>,
	tableNames: readonly (keyof Tables & string)[],
): ServerDbUtilities<Tables> {
	const out: Record<string, unknown> = {
		table: <K extends keyof Tables & string>(name: K) => db.table(name),
		clearAll: async () => db.clearAll(),
	};
	for (const t of tableNames) out[t] = db.table(t);
	return out as ServerDbUtilities<Tables>;
}
