/**
 * Auto-generato (plugin Vite / bun core/desktop/routes/write-client-routes-gen.ts).
 * Non modificare a mano.
 */

import { default as _devtools_db, rowCreate as _devtools_db_rowCreate, rowDelete as _devtools_db_rowDelete, rowUpdate as _devtools_db_rowUpdate } from "../../../desktop/routes/_devtools/db/index";

type InferRoute<D> = D extends { _in: infer I; _out: infer O }
	? { in: I; out: O }
	: never;

export type DesktopRoutes = {
	"_devtools.db": InferRoute<typeof _devtools_db>;
	"_devtools.db.rowCreate": InferRoute<typeof _devtools_db_rowCreate>;
	"_devtools.db.rowDelete": InferRoute<typeof _devtools_db_rowDelete>;
	"_devtools.db.rowUpdate": InferRoute<typeof _devtools_db_rowUpdate>;
};

export type DesktopPath = keyof DesktopRoutes & string;

/** Output RPC per path puntato (es. `DesktopRouteOut<"ping">`). */
export type DesktopRouteOut<P extends DesktopPath> = DesktopRoutes[P]["out"];
