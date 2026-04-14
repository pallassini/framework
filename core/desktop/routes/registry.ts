import type { InputSchema } from "../../client/validator/properties/defs";
import { v } from "../../client/validator";
import { desktopConfig } from "../../../desktop/config";
import { rpcJsonUtf8Length } from "../../server/perf/payload-metrics";
import { desktopError } from "../error";
import { compose } from "../middlewares/logic/compose";
import { timeoutMs } from "../middlewares/logic/route-config";
import { desktopMw, type DesktopMiddleware, type DesktopRouteInputConfig, type DesktopRouteNoInputConfig } from "../middlewares";
import type { DesktopContext } from "./context";
import { DESKTOP_ROUTE, type DesktopFn, type DesktopRouteDescTyped } from "./types";

function buildFn(
	inputSchema: InputSchema<unknown> | undefined,
	run: (input: unknown, ctx: DesktopContext) => unknown | Promise<unknown>,
	opts: { middlewares: DesktopMiddleware[]; timeout?: number | { ms: number } },
): DesktopFn {
	const { middlewares, timeout: timeoutOpt } = opts;
	const t = timeoutMs(timeoutOpt);
	const mws = [...middlewares];
	if (t != null) mws.unshift(desktopMw.timeout(t));

	const coreInner = async (rawInput: unknown, ctx: DesktopContext): Promise<unknown> => {
		let input: unknown;
		if (inputSchema != null) {
			try {
				input = inputSchema.parse(rawInput);
			} catch (e) {
				const msg = e instanceof Error ? e.message : String(e);
				desktopError("INPUT", msg);
			}
		} else {
			const forEmpty =
				rawInput === undefined || rawInput === null
					? undefined
					: typeof rawInput === "object" &&
						  !Array.isArray(rawInput) &&
						  Object.keys(rawInput as object).length === 0
						? undefined
						: rawInput;
			try {
				v.empty().parse(forEmpty);
			} catch (e) {
				const msg = e instanceof Error ? e.message : String(e);
				desktopError("INPUT", msg);
			}
			input = undefined;
		}
		const rpc = desktopConfig.log;
		const out = await Promise.resolve(run(input, ctx));
		if (rpc.enabled && rpc.detail === "full") {
			ctx.rpcPayloadSizes = {
				in: rpcJsonUtf8Length(input),
				out: rpcJsonUtf8Length(out),
			};
		}
		return out;
	};

	const inner: DesktopFn =
		mws.length === 0
			? coreInner
			: (rawInput, ctx) => compose(mws, (c) => coreInner(rawInput, c))(ctx);

	const logMw = desktopMw.log();
	return (rawInput, ctx) => logMw(ctx, () => inner(rawInput, ctx));
}

function dWithInput<I, O>(def: DesktopRouteInputConfig<I, O>): DesktopRouteDescTyped<I, O> {
	const middlewares = def.middlewares ?? [];
	const fn = buildFn(
		def.input as InputSchema<unknown>,
		(inp, ctx) => def.run(inp as I, ctx),
		{ middlewares, timeout: def.timeout },
	);
	return {
		[DESKTOP_ROUTE]: true,
		fn,
		_in: undefined as unknown as I,
		_out: undefined as unknown as O,
	};
}

function dNoInput<O>(def: DesktopRouteNoInputConfig<O>): DesktopRouteDescTyped<void, O> {
	const middlewares = def.middlewares ?? [];
	const fn = buildFn(
		undefined,
		(_inp, ctx) => def.run(ctx),
		{ middlewares, timeout: def.timeout },
	);
	return {
		[DESKTOP_ROUTE]: true,
		fn,
		_in: undefined as unknown as void,
		_out: undefined as unknown as O,
	};
}

export function d<O>(def: DesktopRouteNoInputConfig<O>): DesktopRouteDescTyped<void, O>;
export function d<I, O>(def: DesktopRouteInputConfig<I, O>): DesktopRouteDescTyped<I, O>;
export function d<I, O>(
	def: DesktopRouteNoInputConfig<O> | DesktopRouteInputConfig<I, O>,
): DesktopRouteDescTyped<I | void, O> {
	if ("input" in def && def.input !== undefined) return dWithInput(def);
	return dNoInput(def);
}

export function getDesktopFn(desc: DesktopRouteDescTyped<unknown, unknown>): DesktopFn {
	return desc.fn;
}
