import type { DesktopContext } from "../../routes/context";
import type { DesktopMiddleware, Next } from "./types";

export function compose<T>(
	middlewares: DesktopMiddleware<T>[],
	handler: (ctx: DesktopContext) => Promise<T>,
): (ctx: DesktopContext) => Promise<T> {
	return function dispatch(ctx: DesktopContext): Promise<T> {
		let i = 0;
		const next: Next<T> = () => {
			if (i >= middlewares.length) return handler(ctx);
			return middlewares[i++]!(ctx, next);
		};
		return next();
	};
}
