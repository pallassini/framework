import type { InputSchema } from "../../../client/validator/properties/defs";
import type { DesktopContext } from "../../routes/context";
import type { DesktopMiddleware } from "./types";

export function timeoutMs(timeout: number | { ms: number } | undefined): number | undefined {
	if (timeout == null) return undefined;
	return typeof timeout === "number" ? timeout : timeout.ms;
}

export type DesktopRouteInputConfig<I, O> = {
	input: InputSchema<I>;
	run: (input: I, ctx: DesktopContext) => O | Promise<O>;
	middlewares?: DesktopMiddleware[];
	timeout?: number | { ms: number };
};

export type DesktopRouteNoInputConfig<O> = {
	run: (ctx: DesktopContext) => O | Promise<O>;
	middlewares?: DesktopMiddleware[];
	timeout?: number | { ms: number };
};
