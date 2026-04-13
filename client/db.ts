import { server } from "client";
import type { ServerRouteOut } from "../core/client/server/routes-gen";
import type { DbRequest } from "../server/routes/db";
import type { RpcCallbacks } from "../core/client/server/server";

export type { DbRequest };

/** Risposta RPC `server.db`. */
export type DbRpcResult = ServerRouteOut<"db">;

type DbOpts = RpcCallbacks<DbRpcResult>;

export type UsersCreatePayload = NonNullable<
	Extract<DbRequest, { op: "users.create" }>["payload"]
>;

export type UsersUpdatePatch = NonNullable<
	Extract<DbRequest, { op: "users.update" }>["patch"]
>;

/**
 * Chiamate di prova al route `server/routes/db.ts`: solo DB custom `users` (CRUD).
 */
export const dbRpc = {
	probe(opts?: DbOpts) {
		return server.db({ op: "probe" } satisfies DbRequest, opts);
	},

	usersList(opts?: DbOpts) {
		return server.db({ op: "users.list" } satisfies DbRequest, opts);
	},

	usersCreate(payload: UsersCreatePayload, opts?: DbOpts) {
		return server.db({ op: "users.create", payload } satisfies DbRequest, opts);
	},

	usersUpdate(id: string, patch: UsersUpdatePatch, opts?: DbOpts) {
		return server.db({ op: "users.update", id, patch } satisfies DbRequest, opts);
	},

	usersDelete(id: string, opts?: DbOpts) {
		return server.db({ op: "users.delete", id } satisfies DbRequest, opts);
	},
};
