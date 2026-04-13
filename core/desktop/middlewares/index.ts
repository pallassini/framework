import { log } from "./log";
import { timeout } from "./timeout";

export { log } from "./log";
export { timeout } from "./timeout";

/** Middleware esposti a `d({ … })` (niente CORS: ha senso solo su HTTP). */
export const desktopMw = {
	timeout,
	log,
} as const;

export type { DesktopMiddleware, Next } from "./logic/types";
export type { DesktopRouteInputConfig, DesktopRouteNoInputConfig } from "./logic/route-config";
