/**
 * Auto-generato (plugin Vite / bun core/server/routes/generate.ts).
 * Non modificare a mano.
 */

import { custom as db_custom, default as db } from "../../../server/routes/db";
import { brooo as ping_brooo, default as ping } from "../../../server/routes/ping";

type InferRoute<D> = D extends { _in: infer I; _out: infer O }
	? { in: I; out: O }
	: never;

export type ServerRoutes = {
	db: InferRoute<typeof db>;
	"db.custom": InferRoute<typeof db_custom>;
	ping: InferRoute<typeof ping>;
	"ping.brooo": InferRoute<typeof ping_brooo>;
};

export type ServerPath = keyof ServerRoutes & string;

/** Output RPC per path puntato (es. `ServerRouteOut<"ping.brooo">`). */
export type ServerRouteOut<P extends ServerPath> = ServerRoutes[P]["out"];
