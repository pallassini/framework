import { watch } from "../effect";
import { getStoreSnapshot, setStoreFromSnapshot } from "../utils/store";
import { broadcastPersistUpdate, createPersistBroadcast, getPersistState, setPersistState } from "./idb";

const DEBOUNCE_MS = 300;

export function bindPersistIdb(store: Record<string, unknown>, key: string): void {
	const hydrate = (snapshot: unknown) => {
		if (snapshot && typeof snapshot === "object") {
			setStoreFromSnapshot(store, snapshot as Record<string, unknown>);
		}
	};

	void getPersistState(key).then(hydrate);

	let tid: ReturnType<typeof setTimeout> | null = null;
	const flush = (): void => {
		if (tid != null) clearTimeout(tid);
		tid = null;
		void setPersistState(key, getStoreSnapshot(store)).then(() => broadcastPersistUpdate(key));
	};

	watch(() => {
		getStoreSnapshot(store);
		if (tid != null) clearTimeout(tid);
		tid = setTimeout(flush, DEBOUNCE_MS);
	});

	if (typeof window !== "undefined") {
		window.addEventListener("beforeunload", flush);
		document.addEventListener("visibilitychange", () => {
			if (document.visibilityState === "hidden") flush();
		});
	}

	createPersistBroadcast(key, () => {
		void getPersistState(key).then(hydrate);
	});
}
