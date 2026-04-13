import { logRpcError, logRpcSuccess } from "../perf/rpc-log";
import type { Middleware } from "./logic/types";

/** Log RPC (tag attenuato + in/out + contributi middleware) — registry. */
export function log(): Middleware {
	return async (ctx, next) => {
		const t0 = performance.now();
		try {
			const r = await next();
			logRpcSuccess("server", ctx, t0);
			return r;
		} catch (e) {
			logRpcError("server", ctx, t0, e);
			throw e;
		}
	};
}
