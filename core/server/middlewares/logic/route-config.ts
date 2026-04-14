import type { InputSchema } from "../../../client/validator/properties/defs";
import type { CorsRule } from "../cors";
import type { ConcurrencyOpts, RateLimitOpts, SizeLimitOpts } from "./opts";
import type { Middleware } from "./types";

export function timeoutMs(timeout: number | { ms: number } | undefined): number | undefined {
	if (timeout == null) return undefined;
	return typeof timeout === "number" ? timeout : timeout.ms;
}

/** Opzioni `s({ ... })` con body in ingresso. */
export type RouteInputConfig<I, O> = {
	input: InputSchema<I>;
	/** Stesso `I` di `input: v.object(…)` → `run: (input) =>` tipizzato senza annotazioni. */
	run: (input: I) => O | Promise<O>;
	middlewares?: Middleware[];
	rateLimit?: RateLimitOpts;
	timeout?: number | { ms: number };
	cache?: number;
	cors?: CorsRule;
	sizeLimit?: SizeLimitOpts;
	concurrency?: ConcurrencyOpts;
};

/** Opzioni `s({ ... })` senza body RPC. */
export type RouteNoInputConfig<O> = {
	run: () => O | Promise<O>;
	middlewares?: Middleware[];
	rateLimit?: RateLimitOpts;
	timeout?: number | { ms: number };
	cache?: number;
	cors?: CorsRule;
	sizeLimit?: SizeLimitOpts;
	concurrency?: ConcurrencyOpts;
};
