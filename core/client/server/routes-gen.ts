/**
 * Auto-generato (plugin Vite / bun core/server/routes/generate.ts).
 * Non modificare a mano.
 */

import { brooo as ping_brooo, default as ping } from "../../../server/routes/ping";

type InferRoute<D> = D extends { _in: infer I; _out: infer O }
	? { in: I; out: O }
	: never;

export type ServerRoutes = {
	ping: InferRoute<typeof ping>;
	"ping.brooo": InferRoute<typeof ping_brooo>;
};

export type ServerPath = keyof ServerRoutes & string;
