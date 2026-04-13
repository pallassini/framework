/**
 * Auto-generato (plugin Vite / bun core/desktop/routes/write-client-routes-gen.ts).
 * Non modificare a mano.
 */

import { default as ping } from "../../../desktop/routes/ping";

type InferRoute<D> = D extends { _in: infer I; _out: infer O }
	? { in: I; out: O }
	: never;

export type DesktopRoutes = {
	ping: InferRoute<typeof ping>;
};

export type DesktopPath = keyof DesktopRoutes & string;
