import path from "node:path";
import { ptr } from "bun:ffi";
import { tryLoadFwdb, u8, type FwdbEnginePtr, type FwdbNative } from "../native/load";
import type { CatalogJson } from "../schema/defineSchema";
import { applySelect, fkMapFromCatalog, type BatchFetcher, type FkMap } from "./select";
import { runTx, type TxApi } from "./tx";
import type {
	CountOpts,
	DeleteResult,
	DbRow,
	DeleteOpts,
	FindOpts,
	FindOptions,
	OneOrMany,
	Projected,
	TableAccessor,
	UpdateOpts,
	UpdatePatch,
	UpdateResult,
	Where,
} from "./types";
import { ZigTable } from "./zigTable";

export type TablesMap = Record<string, DbRow>;

export type CustomDbOpenOptions = {
	/**
	 * Directory dati (catalog, snapshot, WAL).
	 * Se omessa: `FWDB_DATA` oppure `<root>/core/db/data` (`FRAMEWORK_PROJECT_ROOT` o `cwd`).
	 */
	dataDir?: string | null;
	pkByTable?: Readonly<Record<string, string>>;
	/** Catalog completo (tabelle/FK/indici) — usato per risolvere `select` con FK. */
	catalog?: CatalogJson;
};

/** Path predefinito relativo alla root del repo (`core/db/data`). */
export const FWDB_DEFAULT_DATA_REL_PATH = path.join("core", "db", "data");

function defaultDataDir(): string {
	const env = process.env.FWDB_DATA?.trim();
	if (env) return env;
	const root = process.env.FRAMEWORK_PROJECT_ROOT?.trim();
	if (root) return path.join(root, FWDB_DEFAULT_DATA_REL_PATH);
	return path.join(process.cwd(), FWDB_DEFAULT_DATA_REL_PATH);
}

/** Stessa risoluzione di `CustomDb` per `dataDir` (per scrivere `catalog.json` prima di aprire Zig). */
export function resolveFwdbDataDir(options?: Pick<CustomDbOpenOptions, "dataDir">): string {
	const dataDirOpt =
		options?.dataDir !== undefined && options?.dataDir !== null
			? options.dataDir.trim() || defaultDataDir()
			: defaultDataDir();
	if (!dataDirOpt) {
		throw new Error(
			`[fwdb] directory dati obbligatoria: imposta FWDB_DATA, CustomDb({ dataDir }), o usa <root>/${FWDB_DEFAULT_DATA_REL_PATH.replace(/\\/g, "/")}.`,
		);
	}
	return dataDirOpt;
}

function toCreateRows<T extends DbRow>(input: OneOrMany<Omit<T, "id"> & Partial<Pick<T, "id">>>): T[] {
	const list = Array.isArray(input) ? input : [input];
	return list.map((row) => {
		const id = row.id ? String(row.id) : crypto.randomUUID();
		return { ...row, id } as T;
	});
}

function normalizeEnginePtr(raw: FwdbEnginePtr | undefined | null): FwdbEnginePtr | null {
	if (raw === undefined || raw === null) return null;
	if (raw === 0 || raw === 0n) return null;
	return raw;
}

/**
 * Riconosce se il primo argomento è la nuova object-form `{ where, select, … }`
 * oppure una vecchia `Where<T>` (che potrebbe condividere chiavi come `limit`
 * se la tabella avesse un campo `limit` — improbabile, ma discriminiamo cercando
 * chiavi riservate esclusive della nuova API).
 */
const NEW_API_KEYS = new Set(["where", "select", "set"]);
function looksLikeOptsBag(arg: unknown): boolean {
	if (!arg || typeof arg !== "object" || Array.isArray(arg)) return false;
	for (const k of Object.keys(arg)) if (NEW_API_KEYS.has(k)) return true;
	return false;
}

/** Solo motore Zig su disco: nessun fallback in-memory. */
export class CustomDb<Tables extends TablesMap> {
	private readonly tables = new Map<string, ZigTable<DbRow>>();
	private readonly native: FwdbNative;
	private engine: FwdbEnginePtr | null;
	readonly mode = "zig" as const;
	readonly dataDir: string;
	private fkMap: FkMap = {};

	constructor(tableNames: readonly (keyof Tables & string)[], options?: CustomDbOpenOptions) {
		const dataDirOpt = resolveFwdbDataDir(options);

		const loaded = tryLoadFwdb();
		if (!loaded) {
			throw new Error(
				"[fwdb] libreria nativa obbligatoria (nessun fallback RAM). Compila Zig (libfwdb.so / fwdb.dll), imposta FWDB_LIB se serve, verifica zig-out/bin.",
			);
		}
		this.native = loaded;

		const dir = u8(dataDirOpt);
		const raw = this.native.symbols.fwdb_engine_open(ptr(dir) as FwdbEnginePtr, BigInt(dir.length));
		const eng = normalizeEnginePtr(raw);
		if (!eng) {
			throw new Error(`[fwdb] engine_open fallito per: ${dataDirOpt}`);
		}
		this.engine = eng;
		this.dataDir = dataDirOpt;

		const pkMap = options?.pkByTable ?? {};
		for (const t of tableNames) {
			this.tables.set(t, new ZigTable<DbRow>(this.native, this.engine, t, pkMap[t] ?? "id"));
		}
		if (options?.catalog) this.fkMap = fkMapFromCatalog(options.catalog);
	}

	/** Aggiorna la mappa FK (es. dopo HMR dello schema). */
	setCatalog(catalog: CatalogJson): void {
		this.fkMap = fkMapFromCatalog(catalog);
	}

	checkpoint(): void {
		if (!this.native || this.engine == null) return;
		const rc = this.native.symbols.fwdb_checkpoint(this.engine);
		if (rc !== 0) throw new Error(`[fwdb] checkpoint -> ${rc}`);
	}

	close(): void {
		if (!this.native || this.engine == null) return;
		this.native.symbols.fwdb_engine_destroy(this.engine);
		this.engine = null;
	}

	/**
	 * Dopo aver scritto `catalog.json` in `dataDir`: chiude il motore e lo riapre (legge il nuovo catalog).
	 * Usato in dev quando cambia `db/index.ts`.
	 */
	reloadAfterCatalogWrite(
		tableNames: readonly string[],
		pkByTable: Readonly<Record<string, string>>,
		catalog?: CatalogJson,
	): void {
		if (this.engine != null) {
			this.native.symbols.fwdb_engine_destroy(this.engine);
			this.engine = null;
		}
		const dir = u8(this.dataDir);
		const raw = this.native.symbols.fwdb_engine_open(ptr(dir) as FwdbEnginePtr, BigInt(dir.length));
		const eng = normalizeEnginePtr(raw);
		if (!eng) {
			throw new Error(`[fwdb] engine_open fallito dopo reload: ${this.dataDir}`);
		}
		this.engine = eng;
		this.tables.clear();
		for (const t of tableNames) {
			this.tables.set(t, new ZigTable<DbRow>(this.native, this.engine, t, pkByTable[t] ?? "id"));
		}
		if (catalog) this.setCatalog(catalog);
	}

	private tableImpl<K extends keyof Tables & string>(name: K): ZigTable<Tables[K]> {
		const table = this.tables.get(name);
		if (!table) throw new Error(`[db] unknown table "${name}"`);
		return table as ZigTable<Tables[K]>;
	}

	/** Batch fetcher usato dall'engine di `select` (una sola lookup per id via cache). */
	private batchFetcher: BatchFetcher = async (table, ids) => {
		const impl = this.tables.get(table);
		const out = new Map<string, DbRow>();
		if (!impl) return out;
		for (const id of ids) {
			const row = impl.byId(id);
			if (row) out.set(id, row);
		}
		return out;
	};

	table<K extends keyof Tables & string>(name: K): TableAccessor<Tables[K]> {
		const self = this;
		type Row = Tables[K];

		async function runFind(
			where: Where<Row> | undefined,
			opts: FindOptions<Row> | undefined,
			select: readonly string[] | undefined,
		): Promise<Row[] | Record<string, unknown>[]> {
			const impl = self.tableImpl(name);
			const rows = impl.find(where, opts) as Row[];
			if (!select || select.length === 0) return rows;
			const projected = await applySelect(
				rows as unknown as DbRow[],
				select,
				name,
				self.fkMap,
				self.batchFetcher,
			);
			return projected as Record<string, unknown>[];
		}

		// Callable form: `db.users(where?)` → find-all
		const fn = (async (where?: Where<Row>) => self.tableImpl(name).find(where)) as TableAccessor<Row>;

		fn.create = async (
			rows: OneOrMany<Omit<Row, "id"> & Partial<Pick<Row, "id">>>,
		): Promise<Row[]> => self.tableImpl(name).create(toCreateRows(rows));

		fn.find = (async (a?: unknown, b?: unknown): Promise<Row[] | Projected<Row, readonly string[]>[]> => {
			if (looksLikeOptsBag(a)) {
				const o = a as FindOpts<Row>;
				const { where, select, ...win } = o;
				const rows = await runFind(where, win as FindOptions<Row>, select);
				return rows as Row[];
			}
			return runFind(a as Where<Row> | undefined, b as FindOptions<Row> | undefined, undefined) as Promise<
				Row[]
			>;
		}) as TableAccessor<Row>["find"];

		fn.byId = async (id: string): Promise<Row | undefined> => self.tableImpl(name).byId(id);

		fn.update = (async (a: unknown, b?: unknown): Promise<UpdateResult<Row>> => {
			if (looksLikeOptsBag(a)) {
				const o = a as UpdateOpts<Row>;
				return self.tableImpl(name).update(o.where, o.set);
			}
			return self.tableImpl(name).update(a as Where<Row>, b as UpdatePatch<Row>);
		}) as TableAccessor<Row>["update"];

		fn.delete = (async (a: unknown): Promise<DeleteResult> => {
			if (looksLikeOptsBag(a)) {
				const o = a as DeleteOpts<Row>;
				return self.tableImpl(name).delete(o.where);
			}
			return self.tableImpl(name).delete(a as Where<Row>);
		}) as TableAccessor<Row>["delete"];

		fn.count = (async (a?: unknown): Promise<number> => {
			if (looksLikeOptsBag(a)) {
				const o = a as CountOpts<Row>;
				return self.tableImpl(name).count(o.where);
			}
			return self.tableImpl(name).count(a as Where<Row> | undefined);
		}) as TableAccessor<Row>["count"];

		fn.clear = async (): Promise<number> => self.tableImpl(name).clear();
		return fn;
	}

	/**
	 * Best-effort transaction.
	 *
	 * Il motore Zig persiste immediatamente ogni mutazione: questa helper
	 * **non** offre ACID, ma raccoglie rollback inversi registrati via `tx.onRollback`
	 * e li esegue in ordine LIFO se `fn` lancia.
	 */
	tx<T>(fn: (tx: TxApi) => Promise<T>, opts?: Parameters<typeof runTx>[1]): Promise<T> {
		return runTx(fn, opts);
	}

	clearAll(): number {
		let n = 0;
		for (const t of this.tables.values()) n += t.clear();
		return n;
	}
}
