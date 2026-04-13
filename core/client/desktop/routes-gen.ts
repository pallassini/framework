/**
 * Auto-generato (plugin Vite / bun core/desktop/routes/write-client-routes-gen.ts).
 * Non modificare a mano.
 */

import { default as _devtools, p as _devtools_p } from "../../../desktop/routes/_devtools/index";
import { default as ping, prova2 as ping_prova2 } from "../../../desktop/routes/ping";

type InferRoute<D> = D extends { _in: infer I; _out: infer O }
	? { in: I; out: O }
	: never;

export type DesktopRoutes = {
	_devtools: InferRoute<typeof _devtools>;
	"_devtools.p": InferRoute<typeof _devtools_p>;
	ping: InferRoute<typeof ping>;
	"ping.prova2": InferRoute<typeof ping_prova2>;
};

export type DesktopPath = keyof DesktopRoutes & string;

/** Output RPC per path puntato (es. `DesktopRouteOut<"ping">`). */
export type DesktopRouteOut<P extends DesktopPath> = DesktopRoutes[P]["out"];
