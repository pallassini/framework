import type { DesktopContext } from "./context";

export const DESKTOP_ROUTE = Symbol.for("framework.desktop.route");

export type DesktopFn = (rawInput: unknown, ctx: DesktopContext) => Promise<unknown>;

export type DesktopRouteDescTyped<I, O> = {
	readonly [DESKTOP_ROUTE]: true;
	readonly fn: DesktopFn;
	readonly _in: I;
	readonly _out: O;
};

export type DesktopRouteDesc = DesktopRouteDescTyped<unknown, unknown>;

export function isDesktopRoute(v: unknown): v is DesktopRouteDesc {
	return (
		typeof v === "object" &&
		v !== null &&
		(v as Record<symbol, unknown>)[DESKTOP_ROUTE] === true
	);
}
