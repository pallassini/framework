import { idbDeleteMany, idbGet, idbSet } from "../utils/idb";

const CHANNEL = "fw_persist_sync";

export const getPersistState = (key: string) => idbGet("persist", key);
export const setPersistState = (key: string, value: unknown) => idbSet("persist", key, value);
export const deletePersistState = (key: string) => idbDeleteMany("persist", [key]);

export function createPersistBroadcast(key: string, onUpdate: () => void): () => void {
	if (typeof BroadcastChannel === "undefined") return () => {};
	const ch = new BroadcastChannel(CHANNEL);
	ch.onmessage = (e: MessageEvent<{ key: string }>) => {
		if (e.data?.key === key) onUpdate();
	};
	return () => ch.close();
}

export function broadcastPersistUpdate(key: string): void {
	if (typeof BroadcastChannel === "undefined") return;
	const ch = new BroadcastChannel(CHANNEL);
	ch.postMessage({ key });
	ch.close();
}
