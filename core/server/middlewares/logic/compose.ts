import type { ServerContext } from "../../routes/context";
import type { Middleware, Next } from "./types";

export function compose<T>(
	middlewares: Middleware<T>[],
	handler: (ctx: ServerContext) => Promise<T>,
): (ctx: ServerContext) => Promise<T> {
	return function dispatch(ctx: ServerContext): Promise<T> {
		let i = 0;
		const next: Next<T> = () => {
			if (i >= middlewares.length) return handler(ctx);
			return middlewares[i++]!(ctx, next);
		};
		return next();
	};
}
