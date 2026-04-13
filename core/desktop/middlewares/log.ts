import { logRpcError, logRpcSuccess } from "../../perf/rpc-log";
import type { DesktopMiddleware } from "./logic/types";

/** Log RPC (tag attenuato) — inserito dal registry su tutte le route. */
export function log(): DesktopMiddleware {
	return async (ctx, next) => {
		const t0 = performance.now();
		const name = ctx.routeName;
		try {
			const r = await next();
			logRpcSuccess("desktop", name, t0);
			return r;
		} catch (e) {
			logRpcError("desktop", name, t0, e);
			throw e;
		}
	};
}
