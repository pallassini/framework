import { ptr } from "bun:ffi";
import { tryLoadFwdb, u8, type FwdbEnginePtr } from "../native/load";
import { IndexedTable } from "./table";
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

type Store = IndexedTable<DbRow> | ZigTable<DbRow>;

export type CustomDbOpenOptions = {
	/** Directory dati (catalog, snapshot, WAL). Se omessa si usa `process.env.FWDB_DATA`. */
	dataDir?: string | null;
	/** Nome campo PK nel JSON per tabella (default `id`). Deve coincidere con `pk` nello schema. */
	pkByTable?: Readonly<Record<string, string>>;
};

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

export class CustomDb<Tables extends TablesMap> {
	private readonly tables = new Map<string, Store>();
	private readonly native = tryLoadFwdb();
	private engine: FwdbEnginePtr | null;
	readonly mode: "zig" | "memory";
	/** Directory usata da `fwdb_engine_open`, se attiva. */
	readonly dataDir: string | null;

	constructor(tableNames: readonly (keyof Tables & string)[], options?: CustomDbOpenOptions) {
		const envDir = process.env.FWDB_DATA?.trim();
		const dataDirOpt =
			options?.dataDir !== undefined && options?.dataDir !== null
				? options.dataDir.trim() || null
				: envDir || null;

		this.engine = null;
		if (this.native) {
			if (dataDirOpt) {
				const dir = u8(dataDirOpt);
				const raw = this.native.symbols.fwdb_engine_open(
					ptr(dir) as FwdbEnginePtr,
					BigInt(dir.length),
				);
				const eng = normalizeEnginePtr(raw);
				if (!eng) {
					throw new Error(`[fwdb] engine_open failed for directory: ${dataDirOpt}`);
				}
				this.engine = eng;
			} else {
				const raw = this.native.symbols.fwdb_engine_create();
				this.engine = normalizeEnginePtr(raw);
			}
		}

		this.dataDir = dataDirOpt && this.engine != null ? dataDirOpt : null;
		this.mode = this.native && this.engine != null ? "zig" : "memory";

		const pkMap = options?.pkByTable ?? {};
		for (const t of tableNames) {
			if (this.mode === "zig" && this.native && this.engine != null) {
				this.tables.set(t, new ZigTable<DbRow>(this.native, this.engine, t, pkMap[t] ?? "id"));
			} else {
				this.tables.set(t, new IndexedTable<DbRow>());
			}
		}
	}

	/** Snapshot su disco + svuota WAL (no-op se non Zig o senza directory). */
	checkpoint(): void {
		if (!this.native || this.engine == null || !this.dataDir) return;
		const rc = this.native.symbols.fwdb_checkpoint(this.engine);
		if (rc !== 0) throw new Error(`[fwdb] checkpoint -> ${rc}`);
	}

	/** Chiude il motore nativo; non usare più questa istanza. */
	close(): void {
		if (!this.native || this.engine == null) return;
		this.native.symbols.fwdb_engine_destroy(this.engine);
		this.engine = null;
	}

	private tableImpl<K extends keyof Tables & string>(name: K): IndexedTable<Tables[K]> | ZigTable<Tables[K]> {
		const table = this.tables.get(name);
		if (!table) throw new Error(`[db] unknown table "${name}"`);
		return table as IndexedTable<Tables[K]> | ZigTable<Tables[K]>;
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
