import { serverRpc } from "../../server/server";
import type { Engine } from "./engine";
import type { OrmDocInput, OrmDocOutput } from "./rpcTypes";
import type { WhereClause } from "./where";

function toRelPath(tablePath: string): string {
	const t = tablePath.replace(/^\/+/, "");
	if (!t || t.includes("..")) throw new Error("[RpcOrmEngine] tablePath non valido");
	return t;
}

async function call(input: OrmDocInput): Promise<OrmDocOutput> {
	return serverRpc("ormDoc", input as never) as Promise<OrmDocOutput>;
}

/**
 * Motore che inoltra ogni operazione a `POST /_server/ormDoc` (logica e storage sul server).
 */
export class RpcOrmEngine implements Engine {
	readonly kind = "rpc" as const;

	async insert(tablePath: string, pkField: string, row: Record<string, unknown>): Promise<Record<string, unknown>> {
		const out = await call({
			op: "insert",
			relPath: toRelPath(tablePath),
			pkField,
			row,
		});
		if (out.op !== "insert") throw new Error("[RpcOrmEngine] risposta insert inattesa");
		return out.row;
	}

	async update(
		tablePath: string,
		pkField: string,
		clause: WhereClause,
		patch: Record<string, unknown>,
	): Promise<number> {
		const out = await call({
			op: "update",
			relPath: toRelPath(tablePath),
			pkField,
			where: clause,
			patch,
		});
		if (out.op !== "update") throw new Error("[RpcOrmEngine] risposta update inattesa");
		return out.affected;
	}

	async delete(tablePath: string, pkField: string, clause: WhereClause): Promise<number> {
		const out = await call({
			op: "delete",
			relPath: toRelPath(tablePath),
			pkField,
			where: clause,
		});
		if (out.op !== "delete") throw new Error("[RpcOrmEngine] risposta delete inattesa");
		return out.affected;
	}

	async findMany(
		tablePath: string,
		opts: { where?: WhereClause | undefined; limit?: number; offset?: number },
	): Promise<Record<string, unknown>[]> {
		const out = await call({
			op: "findMany",
			relPath: toRelPath(tablePath),
			where: opts.where,
			limit: opts.limit,
			offset: opts.offset,
		});
		if (out.op !== "findMany") throw new Error("[RpcOrmEngine] risposta findMany inattesa");
		return out.rows;
	}
}
