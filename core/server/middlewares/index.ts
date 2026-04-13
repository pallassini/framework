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
} as const;

export type { Middleware, Next } from "./logic/types";
export type { RateLimitOpts, ConcurrencyOpts, ConcurrencySameClientOpts, SizeLimitOpts } from "./logic/opts";
export type { RouteInputConfig, RouteNoInputConfig } from "./logic/route-config";
