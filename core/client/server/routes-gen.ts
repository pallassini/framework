/**
 * Auto-generato (plugin Vite / bun core/server/routes/generate.ts).
 * Non modificare a mano.
 */

import { default as ping, meta as ping_meta } from "../../../server/routes/ping";

type InferRoute<D> = D extends { _in: infer I; _out: infer O }
	? { in: I; out: O }
	: never;

export type ServerRoutes = {
	ping: InferRoute<typeof ping>;
	"ping.meta": InferRoute<typeof ping_meta>;
};

export type ServerPath = keyof ServerRoutes & string;
