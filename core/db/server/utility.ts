import { ValidationError, type InputSchema } from "../../client/validator/properties/defs";
import { CustomDb, type TablesMap } from "../core/customDb";
import type { TableAccessor } from "../core/types";
import type { TxApi } from "../core/tx";
import type { DbBundleSchema } from "../schema/table";
import type { ServerTables } from "..";

export type { ServerTables };

/** @internal sincronizza `db.<tabella>` dopo reload schema in dev. */
export const SYNC_DB_TABLE_SHORTCUTS = Symbol.for("framework.db.syncTableShortcuts");

type Accessors<Tables extends TablesMap> = {
	[K in keyof Tables & string]: TableAccessor<Tables[K]>;
};

/** Nome tabella: `typeof db.tables` include anche `$` (schema input RPC). */
export type DbTableNames<T extends { tables: unknown }> = Exclude<keyof T["tables"], "$">;

const RESERVED = new Set(["table", "clearAll", "schema", "tables", "parse", "tx"]);

export type ServerDbUtilities<Tables extends TablesMap = ServerTables> = {
	table<K extends keyof Tables & string>(name: K): TableAccessor<Tables[K]>;
	clearAll(): Promise<number>;
	/** Permette `table: db` negli input schema (`v.object`). */
	parse(raw: unknown): keyof Tables & string;
	/** Bundle `db/index` (tableNames, catalog, …). */
	schema: DbBundleSchema;
	/**
	 * Best-effort transaction: esegue `fn` e se lancia annulla in LIFO le mutazioni
	 * registrate via `tx.onRollback`. Non è ACID (il motore Zig persiste subito),
	 * ma copre i casi tipici multi-tabella.
	 */
	tx<T>(fn: (tx: TxApi) => Promise<T>): Promise<T>;
	/**
	 * Accessori `users`, `works`, … + `$` = campo `table` per RPC (`v.object({ table: db.tables.$, … })`).
	 * Solo nomi tabella: `DbTableNames<typeof db>` oppure `Exclude<keyof typeof db.tables, "$">`.
	 */
	tables: Accessors<Tables> & { $: InputSchema<keyof Tables & string> };
} & Accessors<Tables>;

export function syncDbTableShortcuts(util: unknown): void {
	const fn = (util as Record<symbol, unknown>)[SYNC_DB_TABLE_SHORTCUTS];
	if (typeof fn === "function") (fn as () => void)();
}

export function createServerDbUtilities<Tables extends TablesMap>(
	db: CustomDb<Tables>,
	getTableNames: () => readonly (keyof Tables & string)[],
	getSchema: () => DbBundleSchema,
): ServerDbUtilities<Tables> {
	const out: Record<string, unknown> = {
		table: <K extends keyof Tables & string>(name: K) => db.table(name),
		clearAll: async () => db.clearAll(),
		tx: <T>(fn: (tx: TxApi) => Promise<T>) => db.tx(fn),
		parse(raw: unknown): keyof Tables & string {
			if (typeof raw !== "string" || !raw) throw new ValidationError("table");
			const names = new Set(getTableNames() as readonly string[]);
			if (!names.has(raw)) throw new ValidationError(`table: ${raw}`);
			return raw as keyof Tables & string;
		},
		get schema() {
			return getSchema();
		},
		tables: {} as Accessors<Tables> & { $: InputSchema<keyof Tables & string> },
	};
	function syncTableShortcuts(): void {
		const names = getTableNames() as readonly string[];
		const nameSet = new Set(names);
		for (const k of Object.keys(out)) {
			if (RESERVED.has(k)) continue;
			if (!nameSet.has(k)) delete out[k];
		}
		const tablesAcc: Record<string, unknown> = {};
		for (const t of names) {
			const acc = db.table(t as never);
			out[t] = acc;
			tablesAcc[t] = acc;
		}
		tablesAcc.$ = {
			parse(raw: unknown): keyof Tables & string {
				if (typeof raw !== "string" || !raw) throw new ValidationError("table");
				if (!nameSet.has(raw)) throw new ValidationError(`table: ${raw}`);
				return raw as keyof Tables & string;
			},
		};
		out.tables = tablesAcc as Accessors<Tables> & { $: InputSchema<keyof Tables & string> };
	}
	syncTableShortcuts();
	(out as Record<symbol, unknown>)[SYNC_DB_TABLE_SHORTCUTS] = syncTableShortcuts;
	return out as ServerDbUtilities<Tables>;
}
