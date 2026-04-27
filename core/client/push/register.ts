/** URL servito da Vite (dev + build) — vedi `vite-plugin-sw-push.ts`. */
export const SW_PUSH_SCRIPT_URL = "/sw-push.js";

let registrationPromise: Promise<ServiceWorkerRegistration> | null = null;

/**
 * Registra lo script push (`core/client/push/sw-push.js`) come service worker.
 * Idempotente: una sola `register` per tab; `updateViaCache: "none"` per ricevere aggiornamenti dello script.
 */
export function initPushServiceWorker(): Promise<ServiceWorkerRegistration> {
	if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
		return Promise.reject(new Error("Service Worker non disponibile"));
	}
	if (!registrationPromise) {
		registrationPromise = (async () => {
			const reg = await navigator.serviceWorker.register(SW_PUSH_SCRIPT_URL, {
				scope: "/",
				updateViaCache: "none",
			});
			await reg.update();
			return navigator.serviceWorker.ready;
		})();
	}
	return registrationPromise;
}
