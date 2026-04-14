/**
 * IndexedDB unico: object store `persist` (condiviso tra tab) e `session` (per tab).
 */

const PERSIST_STORE = "persist";
const SESSION_STORE = "session";
const STORAGE_KEY = "fw_state_app_id";

function randomUuid(): string {
	if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
		return crypto.randomUUID();
	}
	return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
		const r = (Math.random() * 16) | 0;
		return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
	});
}

function getStableAppId(): string {
	if (typeof window === "undefined" || typeof localStorage === "undefined") return "default";
	let id = localStorage.getItem(STORAGE_KEY);
	if (!id) {
		id = randomUuid();
		localStorage.setItem(STORAGE_KEY, id);
	}
	return id;
}

const DB_VERSION = 1;
let dbPromise: Promise<IDBDatabase> | null = null;

/** Callback opzionale quando altri tab bloccano l’upgrade. */
export let idbOnBlocked: ((dbName: string) => void) | null = null;

function openDb(): Promise<IDBDatabase> {
	if (typeof indexedDB === "undefined") return Promise.reject(new Error("no indexedDB"));
	if (dbPromise) return dbPromise;
	const dbName = "fw_state_" + getStableAppId();
	dbPromise = new Promise((resolve, reject) => {
		const r = indexedDB.open(dbName, DB_VERSION);
		r.onerror = () => reject(r.error);
		r.onsuccess = () => resolve(r.result);
		r.onblocked = () => {
			idbOnBlocked?.(dbName);
			if (typeof window !== "undefined") {
				window.dispatchEvent(new CustomEvent("fw_state_idb_blocked", { detail: { dbName } }));
			}
		};
		r.onupgradeneeded = (e) => {
			const db = (e.target as IDBOpenDBRequest).result;
			if (!db.objectStoreNames.contains(PERSIST_STORE)) db.createObjectStore(PERSIST_STORE);
			if (!db.objectStoreNames.contains(SESSION_STORE)) db.createObjectStore(SESSION_STORE);
		};
	});
	return dbPromise;
}

export type IdbStoreName = "persist" | "session";

export function idbGet(store: IdbStoreName, key: string): Promise<unknown> {
	return openDb().then(
		(db) =>
			new Promise((resolve, reject) => {
				const r = db.transaction(store, "readonly").objectStore(store).get(key);
				r.onsuccess = () => resolve(r.result);
				r.onerror = () => reject(r.error);
			}),
	);
}

export function idbSet(store: IdbStoreName, key: string, value: unknown): Promise<void> {
	return openDb().then(
		(db) =>
			new Promise((resolve, reject) => {
				const r = db.transaction(store, "readwrite").objectStore(store).put(value, key);
				r.onsuccess = () => resolve();
				r.onerror = () => reject(r.error);
			}),
	);
}

export function idbGetAllKeys(store: IdbStoreName): Promise<string[]> {
	return openDb().then(
		(db) =>
			new Promise((resolve, reject) => {
				const s = db.transaction(store, "readonly").objectStore(store);
				const req = "getAllKeys" in s
					? (s as IDBObjectStore & { getAllKeys(): IDBRequest<string[]> }).getAllKeys()
					: null;
				if (req) {
					req.onsuccess = () => resolve((req.result ?? []).map(String));
					req.onerror = () => reject(req.error);
					return;
				}
				const keys: string[] = [];
				const cur = s.openKeyCursor();
				cur.onsuccess = () => {
					if (cur.result) {
						keys.push(cur.result.primaryKey as string);
						cur.result.continue();
					} else resolve(keys);
				};
				cur.onerror = () => reject(cur.error);
			}),
	);
}

export function idbDelete(store: IdbStoreName, key: string): Promise<void> {
	return openDb().then(
		(db) =>
			new Promise((resolve, reject) => {
				const r = db.transaction(store, "readwrite").objectStore(store).delete(key);
				r.onsuccess = () => resolve();
				r.onerror = () => reject(r.error);
			}),
	);
}

export function idbDeleteMany(store: IdbStoreName, keys: string[]): Promise<void> {
	if (keys.length === 0) return Promise.resolve();
	return openDb().then(
		(db) =>
			new Promise((resolve, reject) => {
				const t = db.transaction(store, "readwrite");
				const s = t.objectStore(store);
				for (const key of keys) s.delete(key);
				t.oncomplete = () => resolve();
				t.onerror = () => reject(t.error);
			}),
	);
}
