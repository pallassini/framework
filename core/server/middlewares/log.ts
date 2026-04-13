import { logRpcError, logRpcSuccess } from "../../perf/rpc-log";
import type { Middleware } from "./logic/types";

/** Log RPC (tag attenuato) — inserito dal registry su tutte le route. */
export function log(): Middleware {
	return async (ctx, next) => {
		const t0 = performance.now();
		const name = ctx.routeName;
		try {
			const r = await next();
			logRpcSuccess("server", name, t0);
			return r;
		} catch (e) {
			logRpcError("server", name, t0, e);
			throw e;
		}
	};
}
