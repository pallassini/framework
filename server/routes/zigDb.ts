import { v } from "../../core/client/validator";
import type { ServerContext } from "../../core/server/routes/context";
import { s } from "server";
import { benchPutGet, smokeTest } from "../../core/dbCustom";

/** Smoke Zig (o fallback memory). File separato da `db.ts` così non dipende da Postgres. */
export default s({
	run: async () => smokeTest(),
});

/** Stress put/get in-process (default 15k iterazioni, payload 64 B). */
export const bench = s({
	input: v.object({
		iterations: v.optional(v.integer()),
		payloadBytes: v.optional(v.integer()),
	}),
	run: async (
		inp: { iterations?: number; payloadBytes?: number },
		_ctx: ServerContext,
	) =>
		benchPutGet({
			iterations: inp.iterations ?? 15_000,
			payloadBytes: inp.payloadBytes,
		}),
});
