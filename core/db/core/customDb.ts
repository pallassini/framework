import path from "node:path";
import { ptr } from "bun:ffi";
import { tryLoadFwdb, u8, type FwdbEnginePtr, type FwdbNative } from "../native/load";
import type {
	DeleteResult,
	DbRow,
	FindOptions,
	OneOrMany,
	TableAccessor,
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

/** Solo motore Zig su disco: nessun fallback in-memory. */
export class CustomDb<Tables extends TablesMap> {
	private readonly tables = new Map<string, ZigTable<DbRow>>();
	private readonly native: FwdbNative;
	private engine: FwdbEnginePtr | null;
	readonly mode = "zig" as const;
	readonly dataDir: string;

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
	}

	private tableImpl<K extends keyof Tables & string>(name: K): ZigTable<Tables[K]> {
		const table = this.tables.get(name);
		if (!table) throw new Error(`[db] unknown table "${name}"`);
		return table as ZigTable<Tables[K]>;
	}

	table<K extends keyof Tables & string>(name: K): TableAccessor<Tables[K]> {
		const run = async (where?: Where<Tables[K]>): Promise<Tables[K][]> => this.tableImpl(name).find(where);
		const fn = run as TableAccessor<Tables[K]>;
		fn.create = async (
			rows: OneOrMany<Omit<Tables[K], "id"> & Partial<Pick<Tables[K], "id">>>,
		): Promise<Tables[K][]> => this.tableImpl(name).create(toCreateRows(rows));
		fn.find = async (where?: Where<Tables[K]>, opts?: FindOptions<Tables[K]>): Promise<Tables[K][]> =>
			this.tableImpl(name).find(where, opts);
		fn.byId = async (id: string): Promise<Tables[K] | undefined> => this.tableImpl(name).byId(id);
		fn.update = async (where: Where<Tables[K]>, patch: UpdatePatch<Tables[K]>): Promise<UpdateResult<Tables[K]>> =>
			this.tableImpl(name).update(where, patch);
		fn.delete = async (where: Where<Tables[K]>): Promise<DeleteResult> => this.tableImpl(name).delete(where);
		fn.count = async (where?: Where<Tables[K]>): Promise<number> => this.tableImpl(name).count(where);
		fn.clear = async (): Promise<number> => this.tableImpl(name).clear();
		return fn;
	}

	clearAll(): number {
		let n = 0;
		for (const t of this.tables.values()) n += t.clear();
		return n;
	}
}
