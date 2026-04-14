import { watch } from "../effect";
import { enqueueAsyncChain } from "../utils/asyncChain";
import { persistLog, persistShortJson } from "../utils/persistDebug";
import { getStoreSnapshot, setStoreFromSnapshot } from "../utils/store";
import { broadcastPersistUpdate, createPersistBroadcast, getPersistState, setPersistState } from "./idb";

const DEBOUNCE_MS = 300;

export function bindPersistIdb(store: Record<string, unknown>, key: string): void {
	/**
	 * Memoria = reattivo e immediato; IDB = solo persistenza in background (debounce) + sync altre schede.
	 * Le scritture IDB sono **serializzate**: click rapidi / flush concorrenti non possono far completare un `put`
	 * vecchio dopo uno nuovo (snapshot sempre coerente su disco).
	 * La prima hydration da disco è ammessa solo se il watch dello store non è ancora ripartito una seconda volta
	 * (altrimenti c’è già stata almeno una mutazione reattiva o un effetto a catena: la memoria vince).
	 */
	let bootHydrateOpen = true;
	let persistWatchRuns = 0;
	let idbWriteTail = Promise.resolve();
	/** Broadcast hydrate rimandato: memoria può essere più nuova dell’IDB finché il debounce non ha fatto flush. */
	let broadcastHydrateDeferred = false;
	let writing = false;

	const hydrate = (reason: string, snapshot: unknown) => {
		const mem0 = persistShortJson(getStoreSnapshot(store));
		const idb0 = snapshot == null ? "null" : persistShortJson(snapshot);
		persistLog(`hydrate START reason=${reason} key=${key} idb=${idb0} mem=${mem0}`);
		if (snapshot && typeof snapshot === "object") {
			watch.batch(() => {
				setStoreFromSnapshot(store, snapshot as Record<string, unknown>);
			});
		}
		const mem1 = persistShortJson(getStoreSnapshot(store));
		persistLog(`hydrate END   reason=${reason} key=${key} mem=${mem1}`);
	};

	void getPersistState(key).then((snapshot) => {
		if (!bootHydrateOpen) {
			persistLog(`boot IDB SKIP (store già usato) key=${key}`);
			return;
		}
		bootHydrateOpen = false;
		hydrate("boot-idb", snapshot);
	});

	let tid: ReturnType<typeof setTimeout> | null = null;
	const flush = (source: string): void => {
		if (tid != null) clearTimeout(tid);
		tid = null;
		persistLog(`flush QUEUE source=${source} key=${key}`);
		idbWriteTail = enqueueAsyncChain(idbWriteTail, async () => {
			writing = true;
			try {
				const snap = getStoreSnapshot(store);
				persistLog(`idb PUT start key=${key} data=${persistShortJson(snap)}`);
				try {
					await setPersistState(key, snap);
					persistLog(`idb PUT ok key=${key}`);
					broadcastPersistUpdate(key);
					persistLog(`broadcast SENT key=${key}`);
				} catch (err) {
					persistLog(`idb PUT FAIL key=${key} err=${String(err)}`);
				}
			} finally {
				writing = false;
				if (broadcastHydrateDeferred) {
					broadcastHydrateDeferred = false;
					persistLog(`broadcast hydrate RUN deferred (dopo flush locale) key=${key}`);
					const snapshot = await getPersistState(key);
					hydrate("after-broadcast-deferred", snapshot);
				}
			}
		});
	};

	watch(() => {
		getStoreSnapshot(store);
		persistWatchRuns++;
		if (persistWatchRuns > 1) bootHydrateOpen = false;
		if (tid != null) clearTimeout(tid);
		tid = setTimeout(() => flush("debounce"), DEBOUNCE_MS);
	});

	if (typeof window !== "undefined") {
		window.addEventListener("beforeunload", () => flush("beforeunload"));
		document.addEventListener("visibilitychange", () => {
			if (document.visibilityState === "hidden") flush("hidden-tab");
		});
	}

	createPersistBroadcast(key, (info) => {
		persistLog(`broadcast RECV key=${key} from=${info?.from ?? "?"}`);
		if (tid !== null || writing) {
			broadcastHydrateDeferred = true;
			persistLog(`broadcast DEFER hydrate (debounce attivo o idb write in corso) key=${key}`);
			return;
		}
		idbWriteTail = enqueueAsyncChain(idbWriteTail, () =>
			getPersistState(key).then((snapshot) => hydrate("after-broadcast", snapshot)),
		);
	});
}
