import type { InputSchema } from "../../../client/validator/properties/defs";
import type { ServerContext } from "../../routes/context";
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
	run: (input: I, ctx: ServerContext) => O | Promise<O>;
	middlewares?: Middleware[];
	rateLimit?: RateLimitOpts;
	timeout?: number | { ms: number };
	cache?: number;
	cors?: CorsRule;
	sizeLimit?: SizeLimitOpts;
	concurrency?: ConcurrencyOpts;
};

/** Opzioni `s({ ... })` senza input (solo `ctx`). */
export type RouteNoInputConfig<O> = {
	run: (ctx: ServerContext) => O | Promise<O>;
	middlewares?: Middleware[];
	rateLimit?: RateLimitOpts;
	timeout?: number | { ms: number };
	cache?: number;
	cors?: CorsRule;
	sizeLimit?: SizeLimitOpts;
	concurrency?: ConcurrencyOpts;
};
