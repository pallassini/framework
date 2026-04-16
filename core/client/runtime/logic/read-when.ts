import { isSignal, type Signal } from "../../state/state";

/**
 * Usa `<show when={not(logo)}>` invece di `when={!logo}`: nel JSX `!logo` nega il
 * riferimento alla funzione (sempre falsy), non il valore del signal.
 * Qui la negazione avviene dentro `readWhen`, così `logo()` resta tracciato dal `watch`.
 */
export function not(s: Signal<boolean>): () => boolean {
	return () => !Boolean(s());
}

export function readWhen(w: unknown): boolean {
	if (isSignal(w)) return Boolean((w as Signal<unknown>)());
	if (typeof w === "function") return Boolean((w as () => unknown)());
	return Boolean(w);
}
