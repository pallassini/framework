/**
 * Hook per debug animazioni (disattivato: nessun output in console).
 * Per riattivare in futuro, reintrodurre lettura da `localStorage` / `__FW_ANIMATE_DEBUG__`.
 */

export function fwAnimateDebugEnabled(): boolean {
	return false;
}

/** @deprecated Nessun log. */
export function fwAnimateDebugRefreshCache(): void {}

export function fwAnimateDebugLog(..._args: unknown[]): void {}

export function fwLifecycleDebugLog(..._args: unknown[]): void {}
