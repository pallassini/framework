import { watch } from "../effect";
import { enqueueAsyncChain } from "../utils/asyncChain";
import { getStoreSnapshot, setStoreFromSnapshot } from "../utils/store";
import { cleanupStaleSessionKeys, getSessionState, setSessionState } from "./idb";

const DEBOUNCE_MS = 300;

const sessionFlushers = new Set<() => void>();
let sessionGlobalsBound = false;

function ensureSessionGlobals(): void {
	if (sessionGlobalsBound || typeof window === "undefined") return;
	sessionGlobalsBound = true;
	const flushAll = (): void => {
		for (const fn of sessionFlushers) {
			try {
				fn();
			} catch {
				/* */
			}
		}
	};
	window.addEventListener("beforeunload", flushAll);
	document.addEventListener("visibilitychange", () => {
		if (document.visibilityState === "hidden") flushAll();
	});
}

export function bindSessionIdb(store: Record<string, unknown>, key: string): void {
	cleanupStaleSessionKeys();

	/**
	 * Stessa logica del persist: memoria subito, IDB async; scritture IDB serializzate;
	 * boot hydrate solo se non c’è già stato un secondo run reattivo.
	 */
	let bootHydrateOpen = true;
	let sessionWatchRuns = 0;
	let idbWriteTail = Promise.resolve();

	const hydrate = (snapshot: unknown) => {
		if (snapshot && typeof snapshot === "object") {
			watch.batch(() => {
				setStoreFromSnapshot(store, snapshot as Record<string, unknown>);
			});
		}
	};

	void getSessionState(key).then((snapshot) => {
		if (!bootHydrateOpen) return;
		bootHydrateOpen = false;
		hydrate(snapshot);
	});

	let tid: ReturnType<typeof setTimeout> | null = null;
	const flush = (): void => {
		if (tid != null) clearTimeout(tid);
		tid = null;
		idbWriteTail = enqueueAsyncChain(idbWriteTail, () => setSessionState(key, getStoreSnapshot(store)));
	};

	watch(() => {
		getStoreSnapshot(store);
		sessionWatchRuns++;
		if (sessionWatchRuns > 1) bootHydrateOpen = false;
		if (tid != null) clearTimeout(tid);
		tid = setTimeout(flush, DEBOUNCE_MS);
	});

	if (typeof window !== "undefined") {
		ensureSessionGlobals();
		sessionFlushers.add(flush);
	}
}
