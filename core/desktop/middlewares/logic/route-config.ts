import type { InputSchema } from "../../../client/validator/properties/defs";
import type { DesktopMiddleware } from "./types";

export function timeoutMs(timeout: number | { ms: number } | undefined): number | undefined {
	if (timeout == null) return undefined;
	return typeof timeout === "number" ? timeout : timeout.ms;
}

export type DesktopRouteInputConfig<I, O> = {
	input: InputSchema<I>;
	/** Stesso `I` di `input: v.object(…)` → `run: (input) =>` tipizzato senza annotazioni. */
	run: (input: I) => O | Promise<O>;
	middlewares?: DesktopMiddleware[];
	timeout?: number | { ms: number };
};

export type DesktopRouteNoInputConfig<O> = {
	run: () => O | Promise<O>;
	middlewares?: DesktopMiddleware[];
	timeout?: number | { ms: number };
};
