import { For, server, state, type ServerRouteOut } from "client";

export default function DbCustomRoute() {
	const res = state<server<"zigDb">>();
	const zigBench = state<ServerRouteOut<"zigDb.bench"> | null>(null);
	const pgBench = state<ServerRouteOut<"db.bench"> | null>(null);
	const loadSim = state<ServerRouteOut<"loadSim"> | null>(null);

	return (
		<div s="col gap-4 p-4 max-w-2xl">
			<t s="text-18 font-bold text-#fff">dbCustom (Zig engine)</t>
			<t s="text-14 text-#aaa">
				Motore attuale: map id→blob (non relazionale). Benchmark = molti put/get in-process vs molti `select` su Postgres.
			</t>
			<t
				s="text-#ffffff bg-#7c3aed px-3 py-2 rounded pointer inline-block"
				click={() =>
					void server.zigDb({
						onSuccess: (data) => res(data),
						onError: (e) => console.error("[dbCustom]", e),
					})
				}
			>
				Smoke test (ping42 + put/get)
			</t>
			<For each={res} pick={(r) => (r ? [r] : [])}>
				{(data) => (
					<div s="col gap-1">
						<t s="text-#ccc">
							engine={data.engine} ping={data.ping} id={data.putId}
						</t>
						<t s="text-#86efac font-mono text-12">{data.roundtrip}</t>
					</div>
				)}
			</For>

			<div s="col gap-2 border-t-1 border-#333 pt-3">
				<t s="text-16 font-bold text-#fff">Benchmark</t>
				<div s="row gap-2 flex-wrap">
					<t
						s="text-#fff bg-#6d28d9 px-3 py-2 rounded pointer"
						click={() =>
							void server.zigDb.bench(
								{ iterations: 20_000, payloadBytes: 64 },
								{
									onSuccess: (d) => zigBench(d),
									onError: (e) => console.error("[zigDb.bench]", e),
								},
							)
						}
					>
						Zig ~20k put+get (64 B)
					</t>
					<t
						s="text-#fff bg-#0d9488 px-3 py-2 rounded pointer"
						click={() =>
							void server.db.bench(
								{ iterations: 300 },
								{
									onSuccess: (d) => pgBench(d),
									onError: (e) => console.error("[db.bench]", e),
								},
							)
						}
					>
						Postgres 300× select
					</t>
				</div>
				<For each={zigBench} pick={(r) => (r ? [r] : [])}>
					{(d) => (
						<t s="text-12 font-mono text-#a7f3d0">
							zig: engine={d.engine} iter={d.iterations} payload={d.payloadBytes}B totalMs={d.totalMs}{" "}
							pairs/s={d.pairsPerSec}
						</t>
					)}
				</For>
				<For each={pgBench} pick={(r) => (r ? [r] : [])}>
					{(d) => (
						<t s="text-12 font-mono text-#99f6e4">
							postgres: iter={d.iterations} totalMs={d.totalMs} q/s={d.queriesPerSec}
						</t>
					)}
				</For>
			</div>

			<div s="col gap-2 border-t-1 border-#333 pt-3">
				<t s="text-16 font-bold text-#fff">Simulazione carico (mix utenti)</t>
				<t s="text-13 text-#888 leading-relaxed">
					Una sola RPC: N utenti virtuali in parallelo, ciascuno con più round. Mix pseudo-casuale: Zig smoke,
					micro-bench put/get, `select 1`, lettura riga parametrizzata, piccola aggregazione. Zig/mem sono
					serializzati tra loro; Postgres usa il pool in concorrenza reale.
				</t>
				<div s="row gap-2 flex-wrap">
					<t
						s="text-#fff bg-#b45309 px-3 py-2 rounded pointer"
						click={() =>
							void server.loadSim(
								{ virtualUsers: 40, roundsPerUser: 10, zigBenchPairs: 320 },
								{
									onSuccess: (d) => loadSim(d),
									onError: (e) => console.error("[loadSim]", e),
								},
							)
						}
					>
						Run 40×10 (default)
					</t>
					<t
						s="text-#fff bg-#9a3412 px-3 py-2 rounded pointer"
						click={() =>
							void server.loadSim(
								{ virtualUsers: 120, roundsPerUser: 12, zigBenchPairs: 280 },
								{
									onSuccess: (d) => loadSim(d),
									onError: (e) => console.error("[loadSim]", e),
								},
							)
						}
					>
						Run120×12 (pesante)
					</t>
				</div>
				<For each={loadSim} pick={(r) => (r ? [r] : [])}>
					{(d) => (
						<div s="col gap-1 font-mono text-11 text-#fcd34d max-h-80 overflow-y-auto">
							<t s="text-#fde68a">
								wall={d.wallMs}ms req/s={d.overallReqPerSec} ok={d.successCount} err={d.errorCount} tot={d.config.totalRequests}
							</t>
							<t s="text-#a7f3d0">
								lat ms: min={d.latencyMs.min} p50={d.latencyMs.p50} p95={d.latencyMs.p95} p99=
								{d.latencyMs.p99} max={d.latencyMs.max} avg={d.latencyMs.avg}
							</t>
							<t s="text-#cbd5e1">
								zig_smoke: n={d.byKind.zig_smoke.count} avgMs={d.byKind.zig_smoke.avgMs} err=
								{d.byKind.zig_smoke.errors}
							</t>
							<t s="text-#cbd5e1">
								zig_bench: n={d.byKind.zig_bench.count} avgMs={d.byKind.zig_bench.avgMs} err=
								{d.byKind.zig_bench.errors}
							</t>
							<t s="text-#cbd5e1">
								pg_select1: n={d.byKind.pg_select1.count} avgMs={d.byKind.pg_select1.avgMs} err=
								{d.byKind.pg_select1.errors}
							</t>
							<t s="text-#cbd5e1">
								pg_row_read: n={d.byKind.pg_row_read.count} avgMs={d.byKind.pg_row_read.avgMs} err=
								{d.byKind.pg_row_read.errors}
							</t>
							<t s="text-#cbd5e1">
								pg_small_agg: n={d.byKind.pg_small_agg.count} avgMs={d.byKind.pg_small_agg.avgMs} err=
								{d.byKind.pg_small_agg.errors}
							</t>
							<t s="text-#fca5a5">{d.errorSamples.length ? `errors: ${d.errorSamples.join(" | ")}` : ""}</t>
						</div>
					)}
				</For>
			</div>
		</div>
	);
}
