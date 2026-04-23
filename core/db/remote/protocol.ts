import type {
	CountOpts,
	DbRow,
	DeleteOpts,
	DeleteResult,
	FindOptions,
	FindOpts,
	OneOrMany,
	UpdateOpts,
	UpdatePatch,
	UpdateResult,
	Where,
} from "../core/types";
import type { CatalogJson } from "../schema/defineSchema";

/**
 * Protocollo RPC client <-> server admin per operare sul db remoto.
 * Un solo endpoint POST `/_server/_admin/db/rpc` gestisce tutte le `op`.
 * Per payload binari (wal.log) c'è un endpoint raw separato (non RPC).
 */

export type TableOp =
	| {
			op: "table.find";
			table: string;
			where?: Where<DbRow> | undefined;
			opts?: FindOptions<DbRow> | undefined;
	  }
	| {
			op: "table.findOpts";
			table: string;
			opts: FindOpts<DbRow>;
	  }
	| {
			op: "table.byId";
			table: string;
			id: string;
	  }
	| {
			op: "table.count";
			table: string;
			where?: Where<DbRow> | undefined;
	  }
	| {
			op: "table.countOpts";
			table: string;
			opts: CountOpts<DbRow>;
	  }
	| {
			op: "table.create";
			table: string;
			rows: OneOrMany<DbRow & Record<string, unknown>>;
	  }
	| {
			op: "table.update";
			table: string;
			where: Where<DbRow>;
			patch: UpdatePatch<DbRow>;
	  }
	| {
			op: "table.updateOpts";
			table: string;
			opts: UpdateOpts<DbRow>;
	  }
	| {
			op: "table.delete";
			table: string;
			where: Where<DbRow>;
	  }
	| {
			op: "table.deleteOpts";
			table: string;
			opts: DeleteOpts<DbRow>;
	  }
	| {
			op: "table.clear";
			table: string;
	  }
	| {
			op: "db.clearAll";
	  }
	| {
			op: "catalog.get";
	  }
	| {
			op: "catalog.push";
			/** JSON del catalog (stringa già serializzata). Il server la scrive in FWDB_DATA e ricarica. */
			catalogJson: string;
	  }
	| {
			op: "checkpoint";
	  };

export type TableOpResult =
	| { ok: true; rows: DbRow[] }
	| { ok: true; row: DbRow | null }
	| { ok: true; count: number }
	| { ok: true; result: UpdateResult<DbRow> }
	| { ok: true; result: DeleteResult }
	| { ok: true; catalog: CatalogJson | null }
	| { ok: true; cleared: number }
	| { ok: true; reloaded: true; tableNames: string[] }
	| { ok: true; voidOk: true };

export type RemoteErrorBody = {
	ok: false;
	error: {
		type:
			| "INPUT"
			| "UNAUTHORIZED"
			| "NOT_FOUND"
			| "INTERNAL"
			| "PAYLOAD_TOO_LARGE"
			| "ADMIN_DISABLED";
		message: string;
	};
};

export type RemoteRpcResponse<T = TableOpResult> = T | RemoteErrorBody;

/** Header di autenticazione per tutte le chiamate admin. */
export const REMOTE_AUTH_HEADER = "authorization";

/** Path pubblico degli endpoint admin (JSON + binari). */
export const REMOTE_ADMIN_RPC_PATH = "/_server/_admin/db/rpc";
export const REMOTE_ADMIN_WAL_PATH = "/_server/_admin/db/wal";
export const REMOTE_ADMIN_WAL_UPLOAD_PATH = "/_server/_admin/db/wal/upload";

/** Sentinel per i tipi locali che mai escono dal protocollo (l'UpdatePatch function-form non è serializzabile). */
export type WireSafeUpdatePatch<T extends DbRow> = Partial<Omit<T, "id">>;

/** Esporta `CatalogJson` per chi consuma il protocollo senza importare il validator. */
export type { CatalogJson };
