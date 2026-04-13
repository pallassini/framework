/**
 * Auto-generato (plugin Vite / bun core/server/routes/generate.ts).
 * Non modificare a mano.
 */

import { bench as db_bench, default as db } from "../../../server/routes/db";
import { default as loadSim } from "../../../server/routes/loadSim";
import { default as ormDashboardSim } from "../../../server/routes/ormDashboardSim";
import { default as ormDoc } from "../../../server/routes/ormDoc";
import { brooo as ping_brooo, default as ping } from "../../../server/routes/ping";
import { bench as zigDb_bench, default as zigDb } from "../../../server/routes/zigDb";

type InferRoute<D> = D extends { _in: infer I; _out: infer O }
	? { in: I; out: O }
	: never;

export type ServerRoutes = {
	db: InferRoute<typeof db>;
	"db.bench": InferRoute<typeof db_bench>;
	loadSim: InferRoute<typeof loadSim>;
	ormDashboardSim: InferRoute<typeof ormDashboardSim>;
	ormDoc: InferRoute<typeof ormDoc>;
	ping: InferRoute<typeof ping>;
	"ping.brooo": InferRoute<typeof ping_brooo>;
	zigDb: InferRoute<typeof zigDb>;
	"zigDb.bench": InferRoute<typeof zigDb_bench>;
};

export type ServerPath = keyof ServerRoutes & string;

/** Output RPC per path puntato (es. `ServerRouteOut<"ping.brooo">`). */
export type ServerRouteOut<P extends ServerPath> = ServerRoutes[P]["out"];
