/**
 * Auto-generato (plugin Vite / bun core/server/routes/generate.ts).
 * Non modificare a mano.
 */

import { default as db, rowDelete as db_rowDelete, rowUpdate as db_rowUpdate } from "../../../server/routes/db";

type InferRoute<D> = D extends { _in: infer I; _out: infer O }
	? { in: I; out: O }
	: never;

export type ServerRoutes = {
	db: InferRoute<typeof db>;
	"db.rowDelete": InferRoute<typeof db_rowDelete>;
	"db.rowUpdate": InferRoute<typeof db_rowUpdate>;
};

export type ServerPath = keyof ServerRoutes & string;

/** Output RPC per path puntato (es. `ServerRouteOut<"ping.brooo">`). */
export type ServerRouteOut<P extends ServerPath> = ServerRoutes[P]["out"];
