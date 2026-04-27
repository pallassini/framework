import { watch } from "../effect";
import type { Signal } from "../state/signal";
import { enqueueAsyncChain } from "../utils/asyncChain";
import { persistLog, persistShortJson } from "../utils/persistDebug";
import { getStoreSnapshot, setStoreFromSnapshot } from "../utils/store";
import { broadcastPersistUpdate, createPersistBroadcast, getPersistState, setPersistState } from "./idb";
import { bump } from "../../debug/leakProbe";

const DEBOUNCE_MS = 300;

/**
 * Listener globali (`beforeunload`/`visibilitychange`) condivisi fra tutti gli store
 * persisted: una sola registrazione per finestra, indipendentemente da quanti
 * store vengono creati. Ogni store registra solo la propria callback `flush`
 * dentro un Set; rimuovere lo store rimuove anche la callback (vedi cleanup).
 */
const persistFlushers = new Set<() => void>();
let persistGlobalsBound = false;

function ensurePersistGlobals(): void {
	if (persistGlobalsBound || typeof window === "undefined") return;
	persistGlobalsBound = true;
	const flushAll = (): void => {
		for (const fn of persistFlushers) {
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
/** Wrapper scalare per distinguere nell'IDB i valori persistiti come scalari (vs store). */
const SCALAR_TAG = "__fw_scalar__";

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
		ensurePersistGlobals();
		const flusher = (): void => flush("global");
		persistFlushers.add(flusher);
		bump("persistBindings", "create");
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

/**
 * Persistenza per signal scalari (stringa, numero, boolean, array, ecc.).
 * Stesso comportamento di `bindPersistIdb` ma su un singolo `Signal<T>`:
 * - hydrate iniziale da IDB (se non c'è stata già una mutazione reattiva in memoria)
 * - scritture debounced su disco + broadcast cross-tab
 * Il valore è serializzato come `{ [SCALAR_TAG]: true, v: T }`.
 */
export function bindPersistScalarIdb<T>(sig: Signal<T>, key: string): void {
	let bootHydrateOpen = true;
	let persistWatchRuns = 0;
	let idbWriteTail = Promise.resolve();
	let broadcastHydrateDeferred = false;
	let writing = false;

	const hydrate = (reason: string, snapshot: unknown): void => {
		if (snapshot && typeof snapshot === "object" && (snapshot as Record<string, unknown>)[SCALAR_TAG]) {
			const val = (snapshot as { v?: T }).v;
			watch.batch(() => {
				sig(val as T);
			});
			persistLog(`hydrate scalar ${reason} key=${key} v=${persistShortJson(val)}`);
		}
	};

	void getPersistState(key).then((snapshot) => {
		if (!bootHydrateOpen) return;
		bootHydrateOpen = false;
		hydrate("boot-idb", snapshot);
	});

	let tid: ReturnType<typeof setTimeout> | null = null;
	const flush = (source: string): void => {
		if (tid != null) clearTimeout(tid);
		tid = null;
		idbWriteTail = enqueueAsyncChain(idbWriteTail, async () => {
			writing = true;
			try {
				const v = sig();
				const snap = { [SCALAR_TAG]: true, v };
				persistLog(`idb PUT scalar start key=${key} src=${source} v=${persistShortJson(v)}`);
				try {
					await setPersistState(key, snap);
					broadcastPersistUpdate(key);
				} catch (err) {
					persistLog(`idb PUT scalar FAIL key=${key} err=${String(err)}`);
				}
			} finally {
				writing = false;
				if (broadcastHydrateDeferred) {
					broadcastHydrateDeferred = false;
					const snapshot = await getPersistState(key);
					hydrate("after-broadcast-deferred", snapshot);
				}
			}
		});
	};

	watch(() => {
		sig();
		persistWatchRuns++;
		if (persistWatchRuns > 1) bootHydrateOpen = false;
		if (tid != null) clearTimeout(tid);
		tid = setTimeout(() => flush("debounce"), DEBOUNCE_MS);
	});

	if (typeof window !== "undefined") {
		ensurePersistGlobals();
		const flusher = (): void => flush("global");
		persistFlushers.add(flusher);
		bump("persistBindings", "create");
	}

	createPersistBroadcast(key, () => {
		if (tid !== null || writing) {
			broadcastHydrateDeferred = true;
			return;
		}
		idbWriteTail = enqueueAsyncChain(idbWriteTail, () =>
			getPersistState(key).then((snapshot) => hydrate("after-broadcast", snapshot)),
		);
	});
}
