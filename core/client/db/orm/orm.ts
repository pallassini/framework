import type { Engine } from "./engine";
import { MemoryEngine } from "./engine";
import { RpcOrmEngine } from "./rpcEngine";
import { ZigMirrorEngine } from "./zigMirrorEngine";
import { f, shallowWhere, type WhereClause, w } from "./where";

const SEG_RE = /^[a-zA-Z0-9_-]+$/;

function seg(name: string): string {
	const t = name.trim();
	if (!t || t.includes("/") || t.includes("..") || !SEG_RE.test(t)) {
		throw new Error(`[orm] segmento non valido: "${name}" (usa lettere, numeri, _ -)`);
	}
	return t;
}

export type RowBase = { id: string };

export type TableSchema<T extends RowBase> = {
/** Campo primary key (default `id`). */
	primaryKey?: keyof T & string;
};

export class Table<T extends RowBase> {
	constructor(
		private readonly engine: Engine,
		private readonly tablePath: string,
		private readonly _schema: TableSchema<T>,
		private readonly pkField: keyof T & string = (_schema.primaryKey ?? "id") as keyof T & string,
	) {}

	/** Path logico `…/cartella/tabella` (namespace infinito). */
	get fullPath(): string {
		return this.tablePath;
	}

	/** `insert({ name: "a" })` — `id` opzionale (UUID se assente). */
	async insert(row: Omit<T, "id"> & Partial<Pick<T, "id">>): Promise<T> {
		const r = await this.engine.insert(this.tablePath, this.pkField, row as Record<string, unknown>);
		return r as T;
	}

	/** `update(w(f("id").eq("x")), { name: "b" })` oppure `update({ id: "x" }, { ... })` */
	async update(where: WhereClause | Partial<T>, patch: Partial<T>): Promise<number> {
		const clause =
			"and" in where
				? (where as WhereClause)
				: shallowWhere(where as Record<string, unknown>);
		return this.engine.update(this.tablePath, this.pkField, clause, patch as Record<string, unknown>);
	}

	async delete(where: WhereClause | Partial<T>): Promise<number> {
		const clause =
			"and" in where
				? (where as WhereClause)
				: shallowWhere(where as Record<string, unknown>);
		return this.engine.delete(this.tablePath, this.pkField, clause);
	}

	async findMany(opts?: { where?: WhereClause | Partial<T>; limit?: number; offset?: number }): Promise<T[]> {
		const rawWhere = opts?.where;
		const clause =
			rawWhere == null
				? undefined
				: "and" in rawWhere
					? rawWhere
					: shallowWhere(rawWhere as Record<string, unknown>);
		const rows = await this.engine.findMany(this.tablePath, {
			where: clause,
			limit: opts?.limit,
			offset: opts?.offset,
		});
		return rows as T[];
	}

	async findFirst(opts?: { where?: WhereClause | Partial<T> }): Promise<T | undefined> {
		const rows = await this.findMany({ ...opts, limit: 1 });
		return rows[0];
	}
}

export class Namespace {
	constructor(
		private readonly engine: Engine,
		private readonly segments: readonly string[],
	) {}

	get path(): string {
		return this.segments.length ? `/${this.segments.join("/")}` : "";
	}

	/** Cartella annidata senza limite di profondità (a differenza del singolo schema Postgres). */
	folder(name: string): Namespace {
		return new Namespace(this.engine, [...this.segments, seg(name)]);
	}

	table<T extends RowBase>(name: string, schema: TableSchema<T> = {}): Table<T> {
		const p = `${this.path}/${seg(name)}`;
		return new Table<T>(this.engine, p, schema);
	}
}

export type CreateDbOptions = {
	engine?: Engine;
	/** Se true e la .so è presente, ogni scrittura viene anche serializzata su Zig KV (sperimentale). */
	zigMirror?: boolean;
	/** Tutte le operazioni via RPC `ormDoc` (consigliato in produzione). */
	rpc?: boolean;
};

export function createDb(opts: CreateDbOptions = {}): Namespace {
	let engine: Engine;
	if (opts.engine) engine = opts.engine;
	else if (opts.rpc) engine = new RpcOrmEngine();
	else if (opts.zigMirror) engine = new ZigMirrorEngine();
	else engine = new MemoryEngine();
	return new Namespace(engine, []);
}

export { f, shallowWhere, type WhereClause, w };
