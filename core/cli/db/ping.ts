/**
 * Misura la latenza di rete pura verso un alias remoto.
 *
 *   bun db ping --to prod            # 5 campioni (default)
 *   bun db ping --to prod --n 20     # 20 campioni
 *
 * Esegue:
 *  - 1 TCP/TLS handshake "a freddo" (prima fetch, NON contata)
 *  - N chiamate seriali batch vuote   → round-trip con keep-alive
 *  - N chiamate seriali count(users)  → stessa cosa ma con 1 op reale
 *  - N batch da 10 count              → verifica che N ops = 1 round-trip
 *
 * Mostra p50 / p95 / min / max / avg per ogni scenario.
 */
import {
	REMOTE_ADMIN_RPC_PATH,
	REMOTE_AUTH_HEADER,
} from "../../db/remote/protocol";
import { loadRemoteRegistry, resolveRemoteTarget } from "../../db/remote/resolve";
import type { RemoteTarget } from "../../db/remote/client";
import { cli, humanMs } from "./ui";

const root = process.env.FRAMEWORK_PROJECT_ROOT?.trim() || process.cwd();

async function resolveAlias(alias: string): Promise<RemoteTarget> {
	const registry = await loadRemoteRegistry(root);
	return resolveRemoteTarget(alias, registry);
}

async function hit(target: RemoteTarget, body: unknown): Promise<number> {
	const url = target.baseUrl.replace(/\/+$/, "") + REMOTE_ADMIN_RPC_PATH;
	const t0 = performance.now();
	const res = await fetch(url, {
		method: "POST",
		headers: {
			"content-type": "application/json",
			[REMOTE_AUTH_HEADER]: `Bearer ${target.password}`,
		},
		body: JSON.stringify({ input: body }),
	});
	await res.text();
	const dt = performance.now() - t0;
	if (!res.ok) throw new Error(`status ${String(res.status)} after ${dt.toFixed(1)}ms`);
	return dt;
}

type Stats = { min: number; p50: number; p95: number; max: number; avg: number };

function stats(samples: number[]): Stats {
	const sorted = [...samples].sort((a, b) => a - b);
	const n = sorted.length;
	const at = (p: number) => sorted[Math.min(n - 1, Math.floor((p / 100) * n))]!;
	const avg = sorted.reduce((a, b) => a + b, 0) / n;
	return { min: sorted[0]!, p50: at(50), p95: at(95), max: sorted[n - 1]!, avg };
}

function fmt(s: Stats): string {
	const pad = (n: number) => n.toFixed(1).padStart(6);
	return `p50 ${pad(s.p50)}  p95 ${pad(s.p95)}  min ${pad(s.min)}  max ${pad(s.max)}  avg ${pad(s.avg)}  ms`;
}

export async function runPing(alias: string, n: number): Promise<void> {
	const ui = cli("ping", { alias, subtitle: `${String(n)} samples` });
	try {
		ui.step("risolvo alias");
		const target = await resolveAlias(alias);
		ui.line("url", target.baseUrl, "muted");

		ui.step("warm-up (TLS handshake + DNS)");
		const warm = await hit(target, { op: "table.count", table: "users" });
		ui.line("cold hit", humanMs(warm), "muted");

		ui.divider();
		ui.step(`batch vuoto × ${String(n)}`);
		const empty: number[] = [];
		for (let i = 0; i < n; i++) empty.push(await hit(target, { op: "batch", ops: [] }));
		ui.line("empty", fmt(stats(empty)));

		ui.step(`table.count × ${String(n)}`);
		const one: number[] = [];
		for (let i = 0; i < n; i++) one.push(await hit(target, { op: "table.count", table: "users" }));
		ui.line("single op", fmt(stats(one)));

		ui.step(`batch×10 ops × ${String(n)}`);
		const batchOf10 = Array.from({ length: 10 }, () => ({
			op: "table.count" as const,
			table: "users",
		}));
		const ten: number[] = [];
		for (let i = 0; i < n; i++) ten.push(await hit(target, { op: "batch", ops: batchOf10 }));
		ui.line("batch×10", fmt(stats(ten)));

		ui.divider();
		const netP50 = stats(empty).p50;
		const opP50 = stats(one).p50;
		const dbOverhead = opP50 - netP50;
		const tenP50 = stats(ten).p50;
		const coalescing = tenP50 <= netP50 * 1.2; // tolleranza 20%

		ui.line("network RTT", humanMs(netP50), "info");
		ui.line(
			"db work",
			dbOverhead > 1 ? humanMs(dbOverhead) : "~0 ms (negligible)",
			dbOverhead > 50 ? "warn" : "muted",
		);
		ui.line(
			"coalescing",
			coalescing ? "OK · 10 ops = 1 round-trip" : "DEGRADED · batch costa più del vuoto",
			coalescing ? "ok" : "warn",
		);

		ui.end(coalescing ? "success" : "warning");
	} catch (e) {
		ui.err(e instanceof Error ? e.message : String(e));
		ui.end("error");
		process.exit(1);
	}
}
