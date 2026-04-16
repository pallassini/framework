/**
 * Hook di debug persistenza (output console rimosso). Attiva:
 * - `localStorage.setItem("fw_debug_persist", "1")` poi ricarica, oppure
 * - `globalThis.__FW_DEBUG_PERSIST__ = true`
 */

export function isPersistDebugEnabled(): boolean {
	try {
		if (
			typeof globalThis !== "undefined" &&
			(globalThis as { __FW_DEBUG_PERSIST__?: boolean }).__FW_DEBUG_PERSIST__ === true
		) {
			return true;
		}
		if (typeof localStorage !== "undefined" && localStorage.getItem("fw_debug_persist") === "1") {
			return true;
		}
	} catch {
		/* */
	}
	return false;
}

/** No-op se il flag debug non è attivo. */
export function persistLog(_msg: string): void {
	if (!isPersistDebugEnabled()) return;
}

export function persistShortJson(data: unknown, maxLen = 200): string {
	if (data == null) return String(data);
	try {
		const s = JSON.stringify(data);
		if (s.length <= maxLen) return s;
		return s.slice(0, maxLen) + "…";
	} catch {
		return "?";
	}
}

/** @deprecated Usare persistLog + persistShortJson */
export function persistDebug(_label: string, _detail?: unknown): void {
	if (!isPersistDebugEnabled()) return;
}

/** @deprecated Usare persistShortJson */
export function persistDebugSnapshot(s: unknown, maxLen = 900): string {
	return persistShortJson(s, maxLen);
}
