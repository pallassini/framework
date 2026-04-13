import type { CorsRule } from "../../middlewares/cors";
import type { SizeLimitOpts } from "../../middlewares/logic/opts";
import type { ServerContext } from "../context";

export type ServerFn = (rawInput: unknown, ctx: ServerContext) => Promise<unknown>;

export const SERVER_ROUTE = Symbol.for("framework.server.route");

export type ServerRouteDescTyped<I, O> = {
	readonly [SERVER_ROUTE]: true;
	readonly fn: ServerFn;
	readonly cors?: CorsRule;
	readonly sizeLimit?: SizeLimitOpts;
	readonly _in: I;
	readonly _out: O;
};

export type ServerRouteDesc = ServerRouteDescTyped<unknown, unknown>;

export function isServerRoute(v: unknown): v is ServerRouteDesc {
	return (
		typeof v === "object" &&
		v !== null &&
		(v as Record<symbol, unknown>)[SERVER_ROUTE] === true
	);
}
