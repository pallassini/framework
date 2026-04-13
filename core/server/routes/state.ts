import type { FSWatcher } from "node:fs";
import type { CorsRule } from "../middlewares/cors";
import type { SizeLimitOpts } from "../middlewares/logic/opts";
import type { ServerFn } from "./rpc/types";

export const routeRegistry = new Map<string, ServerFn>();
export const routeCors = new Map<string, CorsRule>();
export const routeMeta = new Map<string, { sizeLimit?: SizeLimitOpts }>();

export const routesState: {
	loaded: boolean;
	routesWatcher: FSWatcher | null;
} = {
	loaded: false,
	routesWatcher: null,
};
