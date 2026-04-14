import { watch } from "../effect";
import { getStoreSnapshot, setStoreFromSnapshot } from "../utils/store";
import { cleanupStaleSessionKeys, getSessionState, setSessionState } from "./idb";

const DEBOUNCE_MS = 300;

export function bindSessionIdb(store: Record<string, unknown>, key: string): void {
	cleanupStaleSessionKeys();

	void getSessionState(key).then((snapshot) => {
		if (snapshot && typeof snapshot === "object") {
			setStoreFromSnapshot(store, snapshot as Record<string, unknown>);
		}
	});

	let tid: ReturnType<typeof setTimeout> | null = null;
	const flush = (): void => {
		if (tid != null) clearTimeout(tid);
		tid = null;
		void setSessionState(key, getStoreSnapshot(store));
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
}
