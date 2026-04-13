/**
 * Auto-generato (plugin Vite / bun core/desktop/routes/write-client-routes-gen.ts).
 * Non modificare a mano.
 */

import { default as ping, prova2 as ping_prova2 } from "../../../desktop/routes/ping";

type InferRoute<D> = D extends { _in: infer I; _out: infer O }
	? { in: I; out: O }
	: never;

export type DesktopRoutes = {
	ping: InferRoute<typeof ping>;
	"ping.prova2": InferRoute<typeof ping_prova2>;
};

export type DesktopPath = keyof DesktopRoutes & string;

/** Output RPC per path puntato (es. `DesktopRouteOut<"ping">`). */
export type DesktopRouteOut<P extends DesktopPath> = DesktopRoutes[P]["out"];
