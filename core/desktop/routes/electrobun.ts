import { desktopRouteRegistry } from "./state";

/**
 * Handler Electrobun `requests`: ogni chiave risolve sul registry **al momento della chiamata**
 * così `loadDesktopRoutes` dopo watch aggiorna il comportamento senza ridefinire RPC.
 */
export function buildElectrobunRequestHandlers(): Record<string, (params: unknown) => Promise<unknown>> {
	return new Proxy({} as Record<string, (params: unknown) => Promise<unknown>>, {
		get(_target, prop: string | symbol) {
			if (typeof prop !== "string" || prop === "then") return undefined;
			return (params: unknown) => {
				const fn = desktopRouteRegistry.get(prop);
				if (typeof fn !== "function") {
					return Promise.reject(new Error(`[desktop] route non registrata sul main: "${prop}"`));
				}
				return fn(params);
			};
		},
		has(_target, prop) {
			return typeof prop === "string" && desktopRouteRegistry.has(prop);
		},
		ownKeys() {
			return [...desktopRouteRegistry.keys()];
		},
		getOwnPropertyDescriptor(_target, prop) {
			if (typeof prop === "string" && desktopRouteRegistry.has(prop)) {
				return { enumerable: true, configurable: true };
			}
			return undefined;
		},
	});
}
