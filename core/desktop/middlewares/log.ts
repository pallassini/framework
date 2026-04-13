import { logRpcError, logRpcSuccess } from "../../server/perf/rpc-log";
import type { DesktopMiddleware } from "./logic/types";

/** Log RPC (tag attenuato + in/out + contributi middleware) — registry. */
export function log(): DesktopMiddleware {
	return async (ctx, next) => {
		const t0 = performance.now();
		try {
			const r = await next();
			logRpcSuccess("desktop", ctx, t0);
			return r;
		} catch (e) {
			logRpcError("desktop", ctx, t0, e);
			throw e;
		}
	};
}
