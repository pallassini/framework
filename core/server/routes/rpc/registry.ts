import type { InputSchema } from "../../../client/validator/properties/defs";
import { v } from "../../../client/validator";
import {
	routeMw,
	type ConcurrencyOpts,
	type Middleware,
	type RateLimitOpts,
	type RouteInputConfig,
	type RouteNoInputConfig,
	type SizeLimitOpts,
} from "../../middlewares";
import { compose } from "../../middlewares/logic/compose";
import { timeoutMs } from "../../middlewares/logic/route-config";
import { error } from "../../error";
import type { ServerContext } from "../context";
import { SERVER_ROUTE, type ServerFn, type ServerRouteDesc, type ServerRouteDescTyped } from "./types";

function buildFn(
	inputSchema: InputSchema<unknown> | undefined,
	run: (input: unknown, ctx: ServerContext) => unknown | Promise<unknown>,
	opts: {
		middlewares: Middleware[];
		rateLimit?: RateLimitOpts;
		timeout?: number | { ms: number };
		cache?: number;
		concurrency?: ConcurrencyOpts;
		sizeLimit?: SizeLimitOpts;
	},
): ServerFn {
	const { middlewares, rateLimit, timeout: timeoutOpt, cache, concurrency, sizeLimit } = opts;
	const t = timeoutMs(timeoutOpt);
	const sizeOut = sizeLimit?.out;

	const mws = [...middlewares];
	if (rateLimit) mws.unshift(routeMw.rateLimit(rateLimit));
	if (t != null) mws.unshift(routeMw.timeout(t));

	const coreInner = async (rawInput: unknown, ctx: ServerContext): Promise<unknown> => {
		let input: unknown;
		if (inputSchema != null) {
			try {
				input = inputSchema.parse(rawInput);
			} catch (e) {
				const msg = e instanceof Error ? e.message : String(e);
				error("INPUT", msg);
			}
		} else {
			try {
				v.empty().parse(rawInput);
			} catch (e) {
				const msg = e instanceof Error ? e.message : String(e);
				error("INPUT", msg);
			}
			input = undefined;
		}
		const out = await Promise.resolve(run(input, ctx));
		if (sizeOut != null) {
			const json = JSON.stringify(out ?? null);
			const outBytes = new TextEncoder().encode(json).byteLength;
			if (outBytes > sizeOut) {
				error("PAYLOAD_TOO_LARGE", `Response body too large (max ${sizeOut} bytes)`);
			}
		}
		return out;
	};

	let pipeline: ServerFn =
		mws.length === 0
			? coreInner
			: (rawInput, ctx) => compose(mws, (c) => coreInner(rawInput, c))(ctx);

	if (concurrency) pipeline = routeMw.concurrency(concurrency)(pipeline);
	if (cache != null) pipeline = routeMw.cache(cache)(pipeline);

	const logMw = routeMw.log();
	return (rawInput, ctx) => logMw(ctx, () => pipeline(rawInput, ctx));
}

function sWithInput<I, O>(def: RouteInputConfig<I, O>): ServerRouteDescTyped<I, O> {
	const middlewares = def.middlewares ?? [];
	const fn = buildFn(
		def.input as InputSchema<unknown>,
		(inp, ctx) => def.run(inp as I, ctx),
		{
			middlewares,
			rateLimit: def.rateLimit,
			timeout: def.timeout,
			cache: def.cache,
			concurrency: def.concurrency,
			sizeLimit: def.sizeLimit,
		},
	);
	return {
		[SERVER_ROUTE]: true,
		fn,
		_in: undefined as unknown as I,
		_out: undefined as unknown as O,
		...(def.cors !== undefined ? { cors: def.cors } : {}),
		...(def.sizeLimit !== undefined ? { sizeLimit: def.sizeLimit } : {}),
	};
}

function sNoInput<O>(def: RouteNoInputConfig<O>): ServerRouteDescTyped<void, O> {
	const middlewares = def.middlewares ?? [];
	const fn = buildFn(
		undefined,
		(_inp, ctx) => def.run(ctx),
		{
			middlewares,
			rateLimit: def.rateLimit,
			timeout: def.timeout,
			cache: def.cache,
			concurrency: def.concurrency,
			sizeLimit: def.sizeLimit,
		},
	);
	return {
		[SERVER_ROUTE]: true,
		fn,
		_in: undefined as unknown as void,
		_out: undefined as unknown as O,
		...(def.cors !== undefined ? { cors: def.cors } : {}),
		...(def.sizeLimit !== undefined ? { sizeLimit: def.sizeLimit } : {}),
	};
}

export function s<O>(def: RouteNoInputConfig<O>): ServerRouteDescTyped<void, O>;
export function s<I, O>(def: RouteInputConfig<I, O>): ServerRouteDescTyped<I, O>;
export function s<I, O>(
	def: RouteNoInputConfig<O> | RouteInputConfig<I, O>,
): ServerRouteDescTyped<I | void, O> {
	if ("input" in def) return sWithInput(def);
	return sNoInput(def);
}

export function getServerFn(desc: ServerRouteDesc): ServerFn {
	return desc.fn;
}
