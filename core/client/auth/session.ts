const KEY = "fw.sessionId";

export function getSessionId(): string | null {
	try {
		if (typeof localStorage === "undefined") return null;
		return localStorage.getItem(KEY);
	} catch {
		return null;
	}
}

export function setSessionId(id: string): void {
	try {
		if (typeof localStorage === "undefined") return;
		localStorage.setItem(KEY, id);
	} catch {
		/* ignore */
	}
}

export function clearSession(): void {
	try {
		if (typeof localStorage === "undefined") return;
		localStorage.removeItem(KEY);
	} catch {
		/* ignore */
	}
}
