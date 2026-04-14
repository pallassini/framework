import { idbDelete, idbDeleteMany, idbGet, idbGetAllKeys, idbSet } from "../utils/idb";

const TAB_COUNTER_KEY = "fw_tab_counter";
const TAB_NUMBER_KEY = "fw_tab_number";

function getTabNumber(): number {
	if (typeof sessionStorage === "undefined") return 1;
	const cached = sessionStorage.getItem(TAB_NUMBER_KEY);
	if (cached != null) return parseInt(cached, 10) || 1;
	const counter = typeof localStorage !== "undefined" ? parseInt(localStorage.getItem(TAB_COUNTER_KEY) ?? "0", 10) : 0;
	const n = counter + 1;
	if (typeof localStorage !== "undefined") localStorage.setItem(TAB_COUNTER_KEY, String(n));
	sessionStorage.setItem(TAB_NUMBER_KEY, String(n));
	return n;
}

function toSessionKey(storageKey: string): string {
	const tab = getTabNumber();
	if (storageKey === "global") return `global.${tab}`;
	if (storageKey.startsWith("local.")) return `local.${tab}.${storageKey.slice(6)}`;
	return storageKey;
}

export const getSessionState = (key: string) => idbGet("session", toSessionKey(key));
export const setSessionState = (key: string, value: unknown) => idbSet("session", toSessionKey(key), value);
export const deleteSessionState = (key: string) => idbDelete("session", toSessionKey(key));

let cleanupDone = false;

/** Rimuove le chiavi session di tab non attive (best-effort). */
export function cleanupStaleSessionKeys(): void {
	if (cleanupDone || typeof sessionStorage === "undefined") return;
	cleanupDone = true;
	const ourTab = getTabNumber();
	void idbGetAllKeys("session")
		.then((keys) => {
			const stale = keys.filter((k) => {
				if (k.startsWith("global.")) return parseInt(k.slice(7), 10) !== ourTab;
				if (k.startsWith("local.")) {
					const dot = k.slice(6).indexOf(".");
					const tab = dot >= 0 ? parseInt(k.slice(6, 6 + dot), 10) : parseInt(k.slice(6), 10);
					return tab !== ourTab;
				}
				return false;
			});
			if (stale.length > 0) void idbDeleteMany("session", stale).catch(() => {});
		})
		.catch(() => {});
}
