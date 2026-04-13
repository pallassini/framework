import type { ServerContext } from "../routes/context";
import type { ServerFn } from "../routes/rpc/types";
import type { ConcurrencyOpts } from "./logic/opts";
import { createGate, type Gate } from "./logic/gate";

export function createConcurrencyWrapper(opts: ConcurrencyOpts): (handler: ServerFn) => ServerFn {
	const global = createGate(opts.max, opts.buffer);
	const sameSpec = opts.sameClient;
	const perIp: Map<string, Gate> | null = sameSpec ? new Map() : null;

	return (handler: ServerFn): ServerFn => {
		return async (rawInput, ctx) => {
			const ip = ctx.ip || "unknown";
			let clientGate: Gate | null = null;
			if (perIp && sameSpec) {
				let g = perIp.get(ip);
				if (!g) {
					g = createGate(sameSpec.max, sameSpec.buffer);
					perIp.set(ip, g);
				}
				clientGate = g;
			}

			let waitedClient = false;
			if (clientGate) {
				waitedClient = (await clientGate.acquire()).waited;
			}
			try {
				const waitedGlobal = (await global.acquire()).waited;
				try {
					const gs = global.snapshot();
					ctx.concurrencyState = {
						active: gs.active,
						max: gs.max,
						queued: gs.queued,
						waited: waitedGlobal || waitedClient,
					};
					if (clientGate) {
						const cs = clientGate.snapshot();
						ctx.concurrencySameClient = {
							active: cs.active,
							max: cs.max,
							queued: cs.queued,
							waited: waitedClient,
						};
					}
					return await handler(rawInput, ctx);
				} finally {
					global.release();
				}
			} finally {
				if (clientGate) {
					clientGate.release();
					if (clientGate.isIdle()) {
						perIp!.delete(ip);
					}
				}
			}
		};
	};
}

export function serverRpcLogPart(ctx: ServerContext): string | undefined {
	const p: string[] = [];
	if (ctx.concurrencyState) {
		const c = ctx.concurrencyState;
		p.push(c.waited ? `conc ${c.active}/${c.max} (wait)` : `conc ${c.active}/${c.max}`);
	}
	if (ctx.concurrencySameClient) {
		const c = ctx.concurrencySameClient;
		p.push(c.waited ? `per-ip ${c.active}/${c.max} (wait)` : `per-ip ${c.active}/${c.max}`);
	}
	if (p.length === 0) return undefined;
	return p.join(" · ");
}
