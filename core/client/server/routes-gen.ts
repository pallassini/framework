/**
 * Auto-generato (plugin Vite / bun core/server/routes/generate.ts).
 * Non modificare a mano.
 */

import { default as db } from "../../../server/routes/db";
import { default as dbCustom } from "../../../server/routes/dbCustom";
import { brooo as ping_brooo, default as ping } from "../../../server/routes/ping";

type InferRoute<D> = D extends { _in: infer I; _out: infer O }
	? { in: I; out: O }
	: never;

export type ServerRoutes = {
	db: InferRoute<typeof db>;
	dbCustom: InferRoute<typeof dbCustom>;
	ping: InferRoute<typeof ping>;
	"ping.brooo": InferRoute<typeof ping_brooo>;
};

export type ServerPath = keyof ServerRoutes & string;

/** Output RPC per path puntato (es. `ServerRouteOut<"ping.brooo">`). */
export type ServerRouteOut<P extends ServerPath> = ServerRoutes[P]["out"];
