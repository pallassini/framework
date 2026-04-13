import { desktopRouteRegistry } from "./state";

/** Mappa `path` route (es. `ping.meta`) → handler Electrobun `requests`. */
export function buildElectrobunRequestHandlers(): Record<string, (params: unknown) => Promise<unknown>> {
	const requests: Record<string, (params: unknown) => Promise<unknown>> = {};
	for (const [path, fn] of desktopRouteRegistry) {
		requests[path] = (params: unknown) => fn(params);
	}
	return requests;
}
