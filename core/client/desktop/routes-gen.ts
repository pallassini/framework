/**
 * Auto-generato (plugin Vite / bun core/desktop/routes/write-client-routes-gen.ts).
 * Non modificare a mano.
 */

import { ping as _devtools_ping } from "../../../desktop/routes/_devtools/index";

type InferRoute<D> = D extends { _in: infer I; _out: infer O }
	? { in: I; out: O }
	: never;

export type DesktopRoutes = {
	"_devtools.ping": InferRoute<typeof _devtools_ping>;
};

export type DesktopPath = keyof DesktopRoutes & string;

/** Output RPC per path puntato (es. `DesktopRouteOut<"ping">`). */
export type DesktopRouteOut<P extends DesktopPath> = DesktopRoutes[P]["out"];
