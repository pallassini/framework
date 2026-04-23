import type { CatalogJson } from "../schema/defineSchema";
import { runTx, type TxApi } from "../core/tx";
import type {
	CountOpts,
	CreateInput,
	DbRow,
	DeleteOpts,
	DeleteResult,
	FindOptions,
	FindOpts,
	OneOrMany,
	TableAccessor,
	UpdateOpts,
	UpdatePatch,
	UpdateResult,
	Where,
} from "../core/types";
import {
	REMOTE_ADMIN_RPC_PATH,
	REMOTE_AUTH_HEADER,
	type RemoteErrorBody,
	type RemoteRpcResponse,
	type TableOp,
	type TableOpResult,
} from "./protocol";

/** Credenziali risolte del remote target. */
export type RemoteTarget = {
	/** URL base senza slash finale (es. `https://booker.example.com`). */
	baseUrl: string;
	/** Password condivisa (bearer). */
	password: string;
	/** Alias logico per messaggi d'errore. */
	alias: string;
};

/** Errore strutturato ritornato da una chiamata remota. */
export class RemoteDbError extends Error {
	readonly type: RemoteErrorBody["error"]["type"] | "NETWORK" | "DECODE";
	readonly status: number | undefined;
	constructor(type: RemoteDbError["type"], message: string, status?: number) {
		super(message);
		this.name = "RemoteDbError";
		this.type = type;
		this.status = status;
	}
}

/** Timeout (ms) per le chiamate remote. Sovrascrivibile via `FWDB_REMOTE_TIMEOUT_MS`. */
function defaultTimeoutMs(): number {
	const raw = Number(process.env.FWDB_REMOTE_TIMEOUT_MS?.trim() || "");
	if (Number.isFinite(raw) && raw > 0) return raw;
	return 30_000;
}

/** Esegue POST JSON su `<base>/_server/_admin/db/rpc` con auth bearer. */
async function callRemote(target: RemoteTarget, op: TableOp): Promise<TableOpResult> {
	const url = target.baseUrl.replace(/\/+$/, "") + REMOTE_ADMIN_RPC_PATH;
	const ac = new AbortController();
	const to = setTimeout(() => ac.abort(), defaultTimeoutMs());
	let res: Response;
	try {
		res = await fetch(url, {
			method: "POST",
			headers: {
				"content-type": "application/json",
				[REMOTE_AUTH_HEADER]: `Bearer ${target.password}`,
			},
			body: JSON.stringify({ input: op }),
			signal: ac.signal,
		});
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		throw new RemoteDbError("NETWORK", `[fwdb/remote:${target.alias}] ${msg}`);
	} finally {
		clearTimeout(to);
	}

	const text = await res.text();
	let body: RemoteRpcResponse;
	try {
		body = text
			? (JSON.parse(text) as RemoteRpcResponse)
			: ({ ok: false, error: { type: "INTERNAL", message: "empty body" } } as RemoteErrorBody);
	} catch {
		throw new RemoteDbError("DECODE", `[fwdb/remote:${target.alias}] risposta non JSON (status ${res.status})`, res.status);
	}

	if (!("ok" in body) || body.ok !== true) {
		const err = (body as RemoteErrorBody).error ?? { type: "INTERNAL", message: `status ${res.status}` };
		throw new RemoteDbError(err.type, `[fwdb/remote:${target.alias}] ${err.message}`, res.status);
	}
	return body;
}

/** Costruisce un TableAccessor che delega ogni operazione al remoto. */
function makeRemoteAccessor<T extends DbRow>(target: RemoteTarget, tableName: string): TableAccessor<T> {
	async function doFindLegacy(where?: Where<T>, opts?: FindOptions<T>): Promise<T[]> {
		const res = await callRemote(target, {
			op: "table.find",
			table: tableName,
			where: where as Where<DbRow> | undefined,
			opts: opts as FindOptions<DbRow> | undefined,
		});
		return "rows" in res ? (res.rows as T[]) : [];
	}

	async function doFindOpts(opts: FindOpts<T>): Promise<unknown[]> {
		const res = await callRemote(target, {
			op: "table.findOpts",
			table: tableName,
			opts: opts as FindOpts<DbRow>,
		});
		return "rows" in res ? (res.rows as unknown[]) : [];
	}

	// Callable form: `db.users(where?)` → find-all
	const fn = async (where?: Where<T>): Promise<T[]> => doFindLegacy(where);

	async function createImpl(rows: OneOrMany<CreateInput<T>>): Promise<T[]> {
		const res = await callRemote(target, {
			op: "table.create",
			table: tableName,
			rows: rows as OneOrMany<DbRow & Record<string, unknown>>,
		});
		return "rows" in res ? (res.rows as T[]) : [];
	}

	async function findImpl(a?: unknown, b?: unknown): Promise<unknown[]> {
		if (
			a &&
			typeof a === "object" &&
			!Array.isArray(a) &&
			("where" in a || "select" in a || "orderBy" in a || "direction" in a || "limit" in a || "offset" in a)
		) {
			return doFindOpts(a as FindOpts<T>);
		}
		return doFindLegacy(a as Where<T> | undefined, b as FindOptions<T> | undefined);
	}

	async function byIdImpl(id: string): Promise<T | undefined> {
		const res = await callRemote(target, { op: "table.byId", table: tableName, id });
		if (!("row" in res)) return undefined;
		return (res.row as T | null) ?? undefined;
	}

	async function updateImpl(a: unknown, b?: unknown): Promise<UpdateResult<T>> {
		if (a && typeof a === "object" && !Array.isArray(a) && ("where" in a || "set" in a)) {
			const o = a as UpdateOpts<T>;
			if (typeof o.set === "function") {
				return materializingUpdate(target, tableName, o.where, o.set as (row: Readonly<T>) => Partial<Omit<T, "id">> | null | undefined);
			}
			const res = await callRemote(target, {
				op: "table.updateOpts",
				table: tableName,
				opts: { where: o.where as Where<DbRow>, set: o.set as UpdatePatch<DbRow> },
			});
			return "result" in res ? (res.result as UpdateResult<T>) : { count: 0, rows: [] };
		}
		const where = a as Where<T>;
		const patch = b as UpdatePatch<T>;
		if (typeof patch === "function") {
			return materializingUpdate(target, tableName, where, patch as (row: Readonly<T>) => Partial<Omit<T, "id">> | null | undefined);
		}
		const res = await callRemote(target, {
			op: "table.update",
			table: tableName,
			where: where as Where<DbRow>,
			patch: patch as UpdatePatch<DbRow>,
		});
		return "result" in res ? (res.result as UpdateResult<T>) : { count: 0, rows: [] };
	}

	async function deleteImpl(a: unknown): Promise<DeleteResult> {
		if (a && typeof a === "object" && !Array.isArray(a) && "where" in a) {
			const o = a as DeleteOpts<T>;
			const res = await callRemote(target, {
				op: "table.deleteOpts",
				table: tableName,
				opts: { where: o.where as Where<DbRow> },
			});
			return "result" in res ? (res.result as DeleteResult) : { count: 0, ids: [] };
		}
		const res = await callRemote(target, {
			op: "table.delete",
			table: tableName,
			where: a as Where<DbRow>,
		});
		return "result" in res ? (res.result as DeleteResult) : { count: 0, ids: [] };
	}

	async function countImpl(a?: unknown): Promise<number> {
		if (a && typeof a === "object" && !Array.isArray(a) && "where" in a) {
			const res = await callRemote(target, {
				op: "table.countOpts",
				table: tableName,
				opts: { where: (a as CountOpts<T>).where as Where<DbRow> | undefined },
			});
			return "count" in res ? Number(res.count) : 0;
		}
		const res = await callRemote(target, {
			op: "table.count",
			table: tableName,
			where: a as Where<DbRow> | undefined,
		});
		return "count" in res ? Number(res.count) : 0;
	}

	async function clearImpl(): Promise<number> {
		const res = await callRemote(target, { op: "table.clear", table: tableName });
		return "cleared" in res ? Number(res.cleared) : 0;
	}

	// Definiamo le property via `Object.defineProperty` per evitare conflitti di tipo
	// con i field schemas dinamici di `TableAccessorFields` (aggiunti poi da `attachShapeHelpers`).
	const target_ = fn as unknown as Record<string, unknown>;
	const define = (key: string, value: unknown): void => {
		Object.defineProperty(target_, key, { value, writable: true, enumerable: true, configurable: true });
	};
	define("create", createImpl);
	define("find", findImpl);
	define("byId", byIdImpl);
	define("update", updateImpl);
	define("delete", deleteImpl);
	define("count", countImpl);
	define("clear", clearImpl);

	return fn as unknown as TableAccessor<T>;
}

/**
 * Update con patch function-form: per preservare la semantica `patch(row)`,
 * prima `find`, poi per ogni riga materializziamo il patch e mandiamo un update
 * puntuale (where = id). Non ottimo a livello di performance ma raro in pratica.
 */
async function materializingUpdate<T extends DbRow>(
	target: RemoteTarget,
	tableName: string,
	where: Where<T>,
	patchFn: (row: Readonly<T>) => Partial<Omit<T, "id">> | null | undefined,
): Promise<UpdateResult<T>> {
	const list = await (async () => {
		const res = await callRemote(target, {
			op: "table.find",
			table: tableName,
			where: where as Where<DbRow>,
		});
		return "rows" in res ? (res.rows as T[]) : [];
	})();
	const outRows: T[] = [];
	let count = 0;
	for (const row of list) {
		const patch = patchFn(row);
		if (!patch) continue;
		const res = await callRemote(target, {
			op: "table.update",
			table: tableName,
			where: { id: row.id } as Where<DbRow>,
			patch: patch as UpdatePatch<DbRow>,
		});
		if ("result" in res) {
			const r = res.result as UpdateResult<T>;
			count += r.count;
			for (const x of r.rows) outRows.push(x);
		}
	}
	return { count, rows: outRows };
}

/**
 * DB remoto: stessa API di `CustomDb` per il consumatore (`createServerDbUtilities`).
 * Non apre la libreria nativa, non ha un `dataDir` locale effettivo.
 */
export class RemoteDb<Tables extends Record<string, DbRow> = Record<string, DbRow>> {
	readonly mode = "remote" as const;
	readonly dataDir: string;
	private target: RemoteTarget;
	private accessors = new Map<string, TableAccessor<DbRow>>();

	constructor(target: RemoteTarget) {
		this.target = target;
		this.dataDir = `remote:${target.alias}`;
	}

	table<K extends keyof Tables & string>(name: K): TableAccessor<Tables[K]> {
		let acc = this.accessors.get(name);
		if (!acc) {
			acc = makeRemoteAccessor<DbRow>(this.target, name);
			this.accessors.set(name, acc);
		}
		return acc as unknown as TableAccessor<Tables[K]>;
	}

	async clearAll(): Promise<number> {
		const res = await callRemote(this.target, { op: "db.clearAll" });
		return "cleared" in res ? Number(res.cleared) : 0;
	}

	tx<T>(fn: (tx: TxApi) => Promise<T>, opts?: Parameters<typeof runTx>[1]): Promise<T> {
		// Best-effort: stessa semantica del locale (no ACID multi-statement).
		// Ogni mutation è una chiamata HTTP atomica; rollback LIFO via tx.onRollback.
		return runTx(fn, opts);
	}

	async checkpoint(): Promise<void> {
		await callRemote(this.target, { op: "checkpoint" });
	}

	async fetchCatalog(): Promise<CatalogJson | null> {
		const res = await callRemote(this.target, { op: "catalog.get" });
		if ("catalog" in res) return (res.catalog ?? null) as CatalogJson | null;
		return null;
	}

	async pushCatalog(catalogJson: string): Promise<{ tableNames: string[] }> {
		const res = await callRemote(this.target, { op: "catalog.push", catalogJson });
		if ("reloaded" in res) return { tableNames: res.tableNames };
		return { tableNames: [] };
	}

	/** No-op: il remoto viene ricaricato via `pushCatalog`. */
	reloadAfterCatalogWrite(
		_tableNames: readonly string[],
		_pkByTable: Readonly<Record<string, string>>,
		_catalog?: CatalogJson,
	): void {
		/* no-op */
	}

	setCatalog(_catalog: CatalogJson): void {
		/* no-op */
	}

	close(): void {
		/* no-op */
	}

	get backendInfo(): { alias: string; baseUrl: string } {
		return { alias: this.target.alias, baseUrl: this.target.baseUrl };
	}
}
