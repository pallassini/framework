import { error } from "../error";
import type { RateLimitOpts } from "./logic/opts";
import type { Middleware } from "./logic/types";

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export function resetRateLimitBuckets(): void {
	buckets.clear();
}

/** Rate limit in-memory per IP (`window` ms, `max` richieste). */
export function limit(opts: RateLimitOpts): Middleware {
	return (ctx, next) => {
		const key = ctx.ip;
		const now = Date.now();
		let bucket = buckets.get(key);

		if (!bucket || bucket.resetAt < now) {
			bucket = { count: 0, resetAt: now + opts.window };
			buckets.set(key, bucket);
		}

		bucket.count++;
		ctx.rateLimitState = {
			used: bucket.count,
			max: opts.max,
			remaining: Math.max(0, opts.max - bucket.count),
			resetAt: bucket.resetAt,
		};

		if (bucket.count > opts.max) error("RATE_LIMIT", "Too many requests");
		return next();
	};
}
