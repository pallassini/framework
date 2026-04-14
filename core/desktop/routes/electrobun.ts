import { desktopRouteRegistry } from "./state";

/**
 * Electrobun fa `{ ...config.handlers.requests }` una sola volta in `defineElectrobunRPC`:
 * un Proxy con `ownKeys` dinamico diventa uno snapshot di metodi → nuove route dopo l’avvio non esistono.
 * Il fallback `_` (createRPC in electrodun) riceve `(method, params)` per ogni richiesta non presente nello snapshot.
 */
export function buildElectrobunRequestHandlers(): Record<string, (params: unknown) => Promise<unknown>> {
	const dispatch = (method: string, params: unknown) => {
		const fn = desktopRouteRegistry.get(method);
		if (typeof fn !== "function") {
			return Promise.reject(new Error(`[desktop] route non registrata sul main: "${method}"`));
		}
		return fn(params);
	};
	return {
		_: (method: string, params: unknown) => dispatch(method, params),
	} as Record<string, (params: unknown) => Promise<unknown>>;
}
