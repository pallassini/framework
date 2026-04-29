import { requireAuth } from "./auth";
import { requireAdmin } from "./require-admin";
import { requireRole } from "./require-role";
import { applyUserTenantScope } from "./user-tenant-scope";
import { createCacheWrapper } from "./cache";
import { createConcurrencyWrapper } from "./concurrency";
import { limit } from "./limit";
import { log } from "./log";
import { timeout } from "./timeout";

export { limit, resetRateLimitBuckets } from "./limit";
export { log } from "./log";
export { timeout } from "./timeout";
export { createCacheWrapper } from "./cache";
export { createConcurrencyWrapper } from "./concurrency";
export type { CorsRule, OriginUrl } from "./cors";
export { corsPreflightResponse, pickAllowOrigin, requestUrlOrigin, withCors } from "./cors";

/** Solo middleware esposti a `s({ … })`; `compose` / `timeoutMs` restano in `logic/` per il registry. */
export const routeMw = {
	log,
	rateLimit: limit,
	timeout,
	cache: createCacheWrapper,
	concurrency: createConcurrencyWrapper,
	requireAuth,
	requireAdmin,
	requireRole,
	applyUserTenantScope,
} as const;

export type { Middleware, Next } from "./logic/types";
export type { RateLimitOpts, ConcurrencyOpts, ConcurrencySameClientOpts, SizeLimitOpts } from "./logic/opts";
export type {
	RouteAutoConfig,
	RouteAutoOp,
	RouteAutoSpec,
	RouteAuth,
	RouteInputConfig,
	RouteNoInputConfig,
	UserRole,
} from "./logic/route-config";

export { collectServerRpcMiddlewareLogParts } from "./rpc-log-collect";
