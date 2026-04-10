/// <reference types="vite/client" />

type HmrUpdatePayload = {
	updates?: Array<{ type?: string; path?: string; acceptedPath?: string }>;
};

type ViteHmr = {
	on(event: "vite:afterUpdate", fn: (payload: HmrUpdatePayload) => void): void;
	dispose(cb: () => void): void;
};

/** Dopo un update JS in dev, re-render tipo HMR senza rifare `routeLoad`. */
export function hot(rerun: () => void, onDispose: () => void): void {
	if (!import.meta.hot) return;
	const h = import.meta.hot as unknown as ViteHmr;
	h.on("vite:afterUpdate", (payload) => {
		const updates = payload?.updates ?? [];
		const hasJsUpdate = updates.some(
			(u: { type?: string }) => (u.type ?? "js-update") !== "css-update",
		);
		if (!hasJsUpdate) return;
		rerun();
	});
	h.dispose(onDispose);
}
