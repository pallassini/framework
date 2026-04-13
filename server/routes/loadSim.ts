import { v } from "../../core/client/validator";
import type { ServerContext } from "../../core/server/routes/context";
import { s } from "server";
import { benchPutGet, runCustomDbSerialized, smokeTest } from "../../core/dbCustom";
import { db } from "../../core/db";

const KINDS = ["zig_smoke", "zig_bench", "pg_select1", "pg_row_read", "pg_small_agg"] as const;
type Kind = (typeof KINDS)[number];

function clampInt(n: number, lo: number, hi: number): number {
	if (!Number.isFinite(n)) return lo;
	return Math.min(hi, Math.max(lo, Math.trunc(n)));
}

function kindIndex(uid: number, round: number): number {
	return Math.abs(Math.imul(uid, 7919) ^ Math.imul(round, 65537)) % KINDS.length;
}

function percentile(sorted: number[], p: number): number {
	if (sorted.length === 0) return 0;
	const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
	return sorted[idx]!;
}

async function oneRequest(
	kind: Kind,
	uid: number,
	round: number,
	zigBenchPairs: number,
): Promise<{ kind: Kind; ms: number; ok: boolean; err?: string }> {
	const t0 = performance.now();
	try {
		switch (kind) {
			case "zig_smoke":
				await runCustomDbSerialized(() => smokeTest());
				break;
			case "zig_bench":
				await runCustomDbSerialized(() =>
					benchPutGet({ iterations: zigBenchPairs, payloadBytes: 64 }),
				);
				break;
			case "pg_select1":
				await db`select 1 as ok`;
				break;
			case "pg_row_read":
				await db`select ${uid}::bigint as user_id, ${round}::int as seq, ${String(uid)}::text as tag`;
				break;
			case "pg_small_agg":
				await db`
					select count(*)::int as c
					from (values (1),(2),(3),(4),(5),(6),(7),(8),(9),(10)) as t(x)
				`;
				break;
			default:
				break;
		}
		return { kind, ms: performance.now() - t0, ok: true };
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		return { kind, ms: performance.now() - t0, ok: false, err: msg };
	}
}

/**
 * Simula molti utenti virtuali in **una sola RPC**: ogni utente esegue in parallelo una sequenza di richieste miste
 * (Zig smoke/bench serializzati + query Postgres concorrenti sul pool). Non è lo stesso di N client HTTP reali,
 * ma misura bene contesa CPU/pool e mix di carico lato server.
 */
export default s({
	input: v.object({
		virtualUsers: v.optional(v.integer()),
		roundsPerUser: v.optional(v.integer()),
		/** Iterazioni put/get per ogni richiesta `zig_bench` (piccolo per non dominare il run). */
		zigBenchPairs: v.optional(v.integer()),
	}),
	timeout: { ms: 120_000 },
	run: async (
		inp: { virtualUsers?: number; roundsPerUser?: number; zigBenchPairs?: number },
		_ctx: ServerContext,
	) => {
		const virtualUsers = clampInt(inp.virtualUsers ?? 40, 1, 400);
		const roundsPerUser = clampInt(inp.roundsPerUser ?? 10, 1, 50);
		const zigBenchPairs = clampInt(inp.zigBenchPairs ?? 350, 50, 8000);

		const wall0 = performance.now();

		const userResults = await Promise.all(
			Array.from({ length: virtualUsers }, async (_, uid) => {
				const samples: { kind: Kind; ms: number; ok: boolean; err?: string }[] = [];
				for (let r = 0; r < roundsPerUser; r++) {
					const ki = kindIndex(uid, r);
					samples.push(await oneRequest(KINDS[ki]!, uid, r, zigBenchPairs));
				}
				return samples;
			}),
		);

		const wallMs = performance.now() - wall0;
		const flat = userResults.flat();
		const totalRequests = flat.length;
		const successCount = flat.filter((x) => x.ok).length;
		const errorCount = totalRequests - successCount;
		const latencies = flat.map((x) => x.ms).sort((a, b) => a - b);
		const sum = latencies.reduce((a, b) => a + b, 0);

		const byKind: Record<string, { count: number; totalMs: number; errors: number; avgMs: number }> = {};
		for (const k of KINDS) {
			byKind[k] = { count: 0, totalMs: 0, errors: 0, avgMs: 0 };
		}
		for (const x of flat) {
			const b = byKind[x.kind]!;
			b.count += 1;
			b.totalMs += x.ms;
			if (!x.ok) b.errors += 1;
		}
		for (const k of KINDS) {
			const b = byKind[k]!;
			b.avgMs = b.count > 0 ? Math.round((b.totalMs / b.count) * 100) / 100 : 0;
		}

		const errSamples = flat
			.filter((x) => !x.ok && x.err)
			.slice(0, 12)
			.map((x) => `${x.kind}: ${x.err}`);

		return {
			ok: true as const,
			note: "Una RPC HTTP: utenti virtuali = Promise.all sul server; Zig/mem serializzati tra loro; Postgres in parallelo sul pool.",
			config: { virtualUsers, roundsPerUser, zigBenchPairs, totalRequests },
			wallMs: Math.round(wallMs * 100) / 100,
			overallReqPerSec: Math.round(wallMs > 0 ? (totalRequests * 1000) / wallMs : 0),
			successCount,
			errorCount,
			latencyMs: {
				min: Math.round((latencies[0] ?? 0) * 100) / 100,
				max: Math.round((latencies[latencies.length - 1] ?? 0) * 100) / 100,
				avg: Math.round((totalRequests > 0 ? sum / totalRequests : 0) * 100) / 100,
				p50: Math.round(percentile(latencies, 50) * 100) / 100,
				p95: Math.round(percentile(latencies, 95) * 100) / 100,
				p99: Math.round(percentile(latencies, 99) * 100) / 100,
			},
			byKind,
			errorSamples: errSamples,
		};
	},
});
