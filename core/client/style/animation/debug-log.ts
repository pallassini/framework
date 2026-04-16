/**
 * Debug animazioni + lifecycle (`onStart` / `onEnd`).
 *
 * Attiva in console prima del caricamento, oppure dopo reload:
 *   localStorage.setItem("fwAnimateDebug", "1")
 *   location.reload()
 * Oppure (stessa sessione, senza storage):
 *   globalThis.__FW_ANIMATE_DEBUG__ = true
 */

function readFlag(): boolean {
	try {
		const g = globalThis as Record<string, unknown>;
		if (g.__FW_ANIMATE_DEBUG__ === true) return true;
		if (typeof g.localStorage === "object" && g.localStorage != null) {
			const v = (g.localStorage as Storage).getItem("fwAnimateDebug");
			if (v === "1" || v === "true") return true;
		}
	} catch {
		/* storage bloccato */
	}
	return false;
}

let cached: boolean | undefined;

export function fwAnimateDebugEnabled(): boolean {
	if (cached !== undefined) return cached;
	cached = readFlag();
	return cached;
}

/** Invalida la cache (es. dopo `localStorage.setItem` nella stessa sessione). */
export function fwAnimateDebugRefreshCache(): void {
	cached = undefined;
}

function ts(): string {
	return typeof performance !== "undefined" && typeof performance.now === "function"
		? performance.now().toFixed(1)
		: "";
}

export function fwAnimateDebugLog(...args: unknown[]): void {
	if (!fwAnimateDebugEnabled()) return;
	const t = ts();
	console.log(t ? `[fw:animate +${t}ms]` : "[fw:animate]", ...args);
}

export function fwLifecycleDebugLog(...args: unknown[]): void {
	if (!fwAnimateDebugEnabled()) return;
	const t = ts();
	console.log(t ? `[fw:lifecycle +${t}ms]` : "[fw:lifecycle]", ...args);
}
