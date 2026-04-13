import { v } from "../../core/client/validator";
import type { ServerContext } from "../../core/server/routes/context";
import { db } from "../../core/db";
import { seedPlanForTier, type DashTier } from "../../core/server/orm/dashboardTier";
import { ensurePgDashboardSchema } from "../../core/server/orm/pgDashboardSchema";
import { seedPgDashboard } from "../../core/server/orm/pgDashboardSeed";
import { runPgDashboardVariant } from "../../core/server/orm/pgDashboardQueries";
import { DASHBOARD_QUERY_VARIANTS } from "../../core/server/orm/dashboardQueries";
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

function asTier(raw: string | undefined): DashTier {
	if (raw === "100k" || raw === "1m") return raw;
	return "10k";
}

let lastTier: DashTier | undefined;
let lastPlanRows = 0;

/**
 * Stesso carico logico di `ormDashboardSim` su Postgres: tabelle `fw_dash_*`, seed bulk SQL,
 * N utenti × R round, varianti read/write allineate (indici espliciti nello schema).
 */
export default s({
	input: v.object({
		tier: v.optional(v.string()),
		virtualUsers: v.optional(v.integer()),
		roundsPerUser: v.optional(v.integer()),
		forceReseed: v.optional(v.boolean()),
	}),
	timeout: { ms: 600_000 },
	sizeLimit: { in: 4096, out: 256 * 1024 },
	run: async (
		inp: { tier?: string; virtualUsers?: number; roundsPerUser?: number; forceReseed?: boolean },
		_ctx: ServerContext,
	) => {
		const tier = asTier(inp.tier);
		const plan = seedPlanForTier(tier);
		const virtualUsers = clampInt(inp.virtualUsers ?? 120, 1, 2000);
		const roundsPerUser = clampInt(inp.roundsPerUser ?? 6, 1, 20);

		await ensurePgDashboardSchema(db);

		if (lastTier !== tier || inp.forceReseed) {
			await seedPgDashboard(db, plan);
			lastTier = tier;
			lastPlanRows =
				plan.orgs +
				plan.users +
				plan.teams +
				plan.team_members +
				plan.projects +
				plan.tasks +
				plan.comments +
				plan.tags +
				plan.taggings +
				plan.invoices +
				plan.line_items +
				plan.metrics;
		}

		const wall0 = performance.now();
		const userResults = await Promise.all(
			Array.from({ length: virtualUsers }, async (_, uid) => {
				const lat: number[] = [];
				let err = 0;
				for (let r = 0; r < roundsPerUser; r++) {
					const variant = Math.abs(Math.imul(uid, 13) ^ Math.imul(r, 17)) % DASHBOARD_QUERY_VARIANTS;
					const t0 = performance.now();
					try {
						await runPgDashboardVariant(db, uid, variant, plan);
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
			note: "Postgres `fw_dash_*`: stesso piano righe del tier ORM; query SQL + indici; mix read/write.",
			config: {
				tier,
				virtualUsers,
				roundsPerUser,
				totalOps,
				queryVariants: DASHBOARD_QUERY_VARIANTS,
				forceReseed: inp.forceReseed ?? false,
				approxRowsSeeded: lastPlanRows,
			},
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
