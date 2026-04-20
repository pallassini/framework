/**
 * Auto-generato (plugin Vite / bun core/server/routes/generate.ts).
 * Non modificare a mano.
 */

import { default as _devtools_db, rowDelete as _devtools_db_rowDelete, rowUpdate as _devtools_db_rowUpdate } from "../../../server/routes/_devtools/db/index";
import { login as auth_login, me as auth_me, register as auth_register } from "../../../server/routes/auth/index";
import { default as db, rowDelete as db_rowDelete, rowUpdate as db_rowUpdate } from "../../../server/routes/db";

type InferRoute<D> = D extends { _in: infer I; _out: infer O }
	? { in: I; out: O }
	: never;

export type ServerRoutes = {
	"_devtools.db": InferRoute<typeof _devtools_db>;
	"_devtools.db.rowDelete": InferRoute<typeof _devtools_db_rowDelete>;
	"_devtools.db.rowUpdate": InferRoute<typeof _devtools_db_rowUpdate>;
	"auth.login": InferRoute<typeof auth_login>;
	"auth.me": InferRoute<typeof auth_me>;
	"auth.register": InferRoute<typeof auth_register>;
	db: InferRoute<typeof db>;
	"db.rowDelete": InferRoute<typeof db_rowDelete>;
	"db.rowUpdate": InferRoute<typeof db_rowUpdate>;
};

export type ServerPath = keyof ServerRoutes & string;

/** Output RPC per path puntato (es. `ServerRouteOut<"ping.brooo">`). */
export type ServerRouteOut<P extends ServerPath> = ServerRoutes[P]["out"];
