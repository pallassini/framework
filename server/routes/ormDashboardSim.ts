import { v } from "../../core/client/validator";
import type { ServerContext } from "../../core/server/routes/context";
import {
	DASH_PREFIX,
	type SeedStats,
	seedDashboard,
} from "../../core/server/orm/dashboardSeed";
import { runDashboardQueryVariant } from "../../core/server/orm/dashboardQueries";
import { ormDocStore } from "../../core/server/orm/docStore";
import { IndexedMemoryEngine } from "../../core/server/orm/indexedEngine";
import { s } from "server";

function clampInt(n: number, lo: number, hi: number): number {
	if (!Number.isFinite(n)) return lo;
	return Math.min(hi, Math.max(lo, Math.trunc(n)));
}

function percentile(sorted: number[], p: number): number {
	if (sorted.length === 0) return 0;
	const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
	return sorted[idx]!;
}

let dashDataSeeded = false;
let lastSeedStats: SeedStats | undefined;

/**
 * Simulazione dashboard pesante: **12 tabelle** correlate (`/app/dash/…`), **~52k righe** seed,
 * **N utenti virtuali** in parallelo ciascuno con **R round** di query **cross-table** (join logici + aggregazioni).
 * Una sola RPC HTTP; utenti = `Promise.all` lato server.
 */
export default s({
	input: v.object({
		virtualUsers: v.optional(v.integer()),
		roundsPerUser: v.optional(v.integer()),
		forceReseed: v.optional(v.boolean()),
	}),
	timeout: { ms: 600_000 },
	sizeLimit: { in: 4096, out: 256 * 1024 },
	run: async (
		inp: { virtualUsers?: number; roundsPerUser?: number; forceReseed?: boolean },
		_ctx: ServerContext,
	) => {
		const store = ormDocStore;
		if (!(store instanceof IndexedMemoryEngine)) {
			throw new Error("[ormDashboardSim] ormDocStore deve essere IndexedMemoryEngine");
		}

		const virtualUsers = clampInt(inp.virtualUsers ?? 120, 1, 2000);
		const roundsPerUser = clampInt(inp.roundsPerUser ?? 6, 1, 20);

		if (!dashDataSeeded || inp.forceReseed) {
			store.clearTablePrefix(DASH_PREFIX);
			lastSeedStats = await seedDashboard(store);
			dashDataSeeded = true;
		}

		const wall0 = performance.now();
		const userResults = await Promise.all(
			Array.from({ length: virtualUsers }, async (_, uid) => {
				const lat: number[] = [];
				let err = 0;
				for (let r = 0; r < roundsPerUser; r++) {
					const variant = Math.abs(Math.imul(uid, 13) ^ Math.imul(r, 17)) % 8;
					const t0 = performance.now();
					try {
						await runDashboardQueryVariant(store, uid, variant);
						lat.push(performance.now() - t0);
					} catch {
						err++;
					}
				}
				return { lat, err };
			}),
		);
		const wallMs = performance.now() - wall0;

		const allLat = userResults.flatMap((u) => u.lat).sort((a, b) => a - b);
		const totalOps = virtualUsers * roundsPerUser;
		const totalErr = userResults.reduce((a, u) => a + u.err, 0);
		const sum = allLat.reduce((a, b) => a + b, 0);

		return {
			ok: true as const,
			note: "Store IndexedMemoryEngine: indici automatici su scalari; query = join manuali TS.",
			config: { virtualUsers, roundsPerUser, totalOps, forceReseed: inp.forceReseed ?? false },
			seed: lastSeedStats ?? [],
			wallMs: Math.round(wallMs * 100) / 100,
			opsPerSecWall: Math.round(wallMs > 0 ? (totalOps * 1000) / wallMs : 0),
			errors: totalErr,
			latencyMs: {
				min: Math.round((allLat[0] ?? 0) * 100) / 100,
				max: Math.round((allLat[allLat.length - 1] ?? 0) * 100) / 100,
				avg: Math.round((allLat.length ? sum / allLat.length : 0) * 100) / 100,
				p50: Math.round(percentile(allLat, 50) * 100) / 100,
				p95: Math.round(percentile(allLat, 95) * 100) / 100,
				p99: Math.round(percentile(allLat, 99) * 100) / 100,
			},
		};
	},
});
