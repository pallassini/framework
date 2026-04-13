import { v } from "../../core/client/validator";
import type { ServerContext } from "../../core/server/routes/context";
import { s } from "server";
import { db } from "../../core/db";

export default s({
	run: async () => {
		const rows = await db`
			select
				current_database() as database,
				current_user as db_user,
				now() as server_time
		`;
		return { ok: true as const, rows };
	},
});

/** Confronto latenza: `select` parametrizzato in loop (rete + Postgres). */
export const bench = s({
	input: v.object({
		iterations: v.optional(v.integer()),
	}),
	run: async (inp: { iterations?: number }, _ctx: ServerContext) => {
		const iterations = Math.min(5000, Math.max(1, inp.iterations ?? 300));
		const t0 = performance.now();
		for (let i = 0; i < iterations; i++) {
			await db`select ${i}::int as n`;
		}
		const totalMs = performance.now() - t0;
		return {
			ok: true as const,
			backend: "postgres" as const,
			iterations,
			totalMs: Math.round(totalMs * 100) / 100,
			queriesPerSec: Math.round(totalMs > 0 ? (iterations * 1000) / totalMs : 0),
		};
	},
});
