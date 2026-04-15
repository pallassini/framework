/**
 * Auto-generato (plugin Vite / bun core/desktop/routes/write-client-routes-gen.ts).
 * Non modificare a mano.
 */

type InferRoute<D> = D extends { _in: infer I; _out: infer O }
	? { in: I; out: O }
	: never;

export type DesktopRoutes = {
};

export type DesktopPath = keyof DesktopRoutes & string;

/** Output RPC per path puntato (es. `DesktopRouteOut<"ping">`). */
export type DesktopRouteOut<P extends DesktopPath> = DesktopRoutes[P]["out"];
