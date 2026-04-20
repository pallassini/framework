import { ValidationError, type InputSchema } from "../../client/validator/properties/defs";
import { object as vObject } from "../../client/validator/properties/object";
import { FIELD_OPTIONAL } from "../../client/validator/field-meta";
import { CustomDb, type TablesMap } from "../core/customDb";
import type { TableAccessor } from "../core/types";
import type { TxApi } from "../core/tx";
import { getFwTableShape, type DbBundleSchema } from "../schema/table";
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

/** Nomi riservati sull'accessor: non sovrascrivibili da colonne con stesso nome. */
const ACC_RESERVED = new Set([
	"create",
	"find",
	"byId",
	"update",
	"delete",
	"count",
	"clear",
	"pick",
	"omit",
	"partial",
	"parse",
]);

function isOptionalSchema(s: InputSchema<unknown>): boolean {
	return typeof s === "object" && s !== null && FIELD_OPTIONAL in (s as object);
}

function toOptionalSchema(s: InputSchema<unknown>): InputSchema<unknown> {
	if (isOptionalSchema(s)) return s;
	const maybe = (s as { optional?: () => InputSchema<unknown> }).optional;
	return typeof maybe === "function" ? maybe.call(s) : s;
}

/**
 * L'accessor tabellare è una `function`; `name` / `length` (e altre) sono read-only
 * con assegnazione diretta → usare defineProperty per le colonne omonime.
 */
function defineOnAccessor(acc: object, key: string, value: unknown): void {
	Object.defineProperty(acc, key, {
		value,
		writable: true,
		enumerable: true,
		configurable: true,
	});
}

/**
 * Collega `pick`, `omit` e i campi direttamente sull'accessor:
 *   `db.items.name`, `db.resources.active.optional()`, `db.items.pick("name", …)`.
 */
function attachShapeHelpers(
	acc: Record<string, unknown>,
	shape: Record<string, InputSchema<unknown>>,
): void {
	for (const [k, s] of Object.entries(shape)) {
		if (ACC_RESERVED.has(k)) {
			console.warn(
				`[db] colonna "${k}" in conflitto con un metodo dell'accessor: campo non esposto come property. Usa db.table.pick("${k}") o rinomina la colonna.`,
			);
			continue;
		}
		defineOnAccessor(acc, k, s);
	}

	// `db.items` è un InputSchema<CreateInput<T>> per la create singola.
	// Per input array usare `v.array(db.items)`.
	const createShape: Record<string, InputSchema<unknown>> = {};
	for (const [k, s] of Object.entries(shape)) {
		createShape[k] = k === "id" || k === "createdAt" || k === "updatedAt" ? toOptionalSchema(s) : s;
	}
	const createObj = vObject(createShape);
	defineOnAccessor(acc, "parse", (raw: unknown) => createObj.parse(raw));
	defineOnAccessor(acc, "pick", (...keys: string[]) => {
		if (keys.length === 0) throw new Error("[db.pick] nessun campo indicato");
		const picked: Record<string, InputSchema<unknown>> = {};
		for (const k of keys) {
			const sch = shape[k];
			if (!sch) throw new Error(`[db.pick] campo sconosciuto: ${k}`);
			picked[k] = sch;
		}
		return vObject(picked);
	});
	defineOnAccessor(acc, "omit", (...keys: string[]) => {
		const drop = new Set(keys);
		const kept: Record<string, InputSchema<unknown>> = {};
		for (const [k, s] of Object.entries(shape)) {
			if (!drop.has(k)) kept[k] = s;
		}
		if (Object.keys(kept).length === 0) throw new Error("[db.omit] non restano campi");
		return vObject(kept);
	});
	defineOnAccessor(
		acc,
		"partial",
		(opts?: {
			omit?: readonly string[];
			with?: Record<string, InputSchema<unknown>>;
			min?: number;
		}) => {
			// `id` / `createdAt` / `updatedAt` non sono mai "patchati": esclusi di default.
			const drop = new Set<string>(["id", "createdAt", "updatedAt", ...(opts?.omit ?? [])]);
			const extra = opts?.with ?? {};
			const min = opts?.min ?? 0;

			const partialShape: Record<string, InputSchema<unknown>> = {};
			for (const [k, s] of Object.entries(shape)) {
				if (drop.has(k)) continue;
				partialShape[k] = toOptionalSchema(s);
			}
			const partialKeys = Object.keys(partialShape);
			const merged: Record<string, InputSchema<unknown>> = { ...partialShape };
			for (const [k, s] of Object.entries(extra)) merged[k] = s;

			const obj = vObject(merged);
			if (min <= 0) return obj;

			return {
				parse(raw: unknown): unknown {
					const parsed = obj.parse(raw) as Record<string, unknown>;
					let count = 0;
					for (const k of partialKeys) {
						if (parsed[k] !== undefined) count++;
					}
					if (count < min) {
						throw new ValidationError(
							`almeno ${min} campo/i tra [${partialKeys.join(", ")}] richiesto/i`,
						);
					}
					return parsed;
				},
			};
		},
	);
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
		const bundle = getSchema();
		const shapeByName = new Map<string, Record<string, InputSchema<unknown>>>();
		for (const fw of bundle.fwTables) {
			const s = getFwTableShape(fw);
			if (s) shapeByName.set(fw.name, s);
		}
		for (const t of names) {
			const acc = db.table(t as never) as Record<string, unknown>;
			const shape = shapeByName.get(t);
			if (shape) attachShapeHelpers(acc, shape);
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
