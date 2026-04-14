/**
 * Auto-generato (plugin Vite / bun core/desktop/routes/write-client-routes-gen.ts).
 * Non modificare a mano.
 */

import { oioi as devtools_oioi } from "../../../desktop/routes/devtools/index";
import { default as p, provaaaaa as p_provaaaaa } from "../../../desktop/routes/p";
import { default as ping, prova2 as ping_prova2 } from "../../../desktop/routes/ping";
import { users as prova_users } from "../../../desktop/routes/prova/index";

type InferRoute<D> = D extends { _in: infer I; _out: infer O }
	? { in: I; out: O }
	: never;

export type DesktopRoutes = {
	"devtools.oioi": InferRoute<typeof devtools_oioi>;
	p: InferRoute<typeof p>;
	"p.provaaaaa": InferRoute<typeof p_provaaaaa>;
	ping: InferRoute<typeof ping>;
	"ping.prova2": InferRoute<typeof ping_prova2>;
	"prova.users": InferRoute<typeof prova_users>;
};

export type DesktopPath = keyof DesktopRoutes & string;

/** Output RPC per path puntato (es. `DesktopRouteOut<"ping">`). */
export type DesktopRouteOut<P extends DesktopPath> = DesktopRoutes[P]["out"];
