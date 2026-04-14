import { idbDeleteMany, idbGet, idbSet } from "../utils/idb";

const CHANNEL = "fw_persist_sync";

/** Identifica questa scheda: i broadcast di persistenza includono `from` così non si fa hydrate da IDB sul proprio messaggio (evita race con snapshot non ancora allineato alla memoria). */
const persistBroadcastSourceId =
	typeof globalThis.crypto !== "undefined" && "randomUUID" in globalThis.crypto
		? globalThis.crypto.randomUUID()
		: `fw-${Math.random().toString(36).slice(2)}`;

export const getPersistState = (key: string) => idbGet("persist", key);
export const setPersistState = (key: string, value: unknown) => idbSet("persist", key, value);
export const deletePersistState = (key: string) => idbDeleteMany("persist", [key]);

export function createPersistBroadcast(
	key: string,
	onUpdate: (info?: { from?: string }) => void,
): () => void {
	if (typeof BroadcastChannel === "undefined") return () => {};
	const ch = new BroadcastChannel(CHANNEL);
	ch.onmessage = (e: MessageEvent<{ key: string; from?: string }>) => {
		if (e.data?.key !== key) return;
		if (e.data.from != null && e.data.from === persistBroadcastSourceId) return;
		onUpdate({ from: e.data.from });
	};
	return () => ch.close();
}

export function broadcastPersistUpdate(key: string): void {
	if (typeof BroadcastChannel === "undefined") return;
	const ch = new BroadcastChannel(CHANNEL);
	ch.postMessage({ key, from: persistBroadcastSourceId });
	ch.close();
}
