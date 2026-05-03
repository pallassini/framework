import { isSignal, type Signal } from "../../state/state";

/**
 * Usa `<show when={not(logo)}>` invece di `when={!logo}`: nel JSX `!logo` nega il
 * riferimento alla funzione (sempre falsy), non il valore del signal.
 * Qui la negazione avviene dentro `readWhen`, così `logo()` resta tracciato dal `watch`.
 */
export function not(s: Signal<boolean>): () => boolean {
	return () => !Boolean(s());
}

/**
 * `show={{ when: cond, instant: true }}`: `readWhen` legge solo `when` (signal/fn/boolean)
 * così il `watch` traccia le dipendenze corrette.
 */
export function readWhen(w: unknown): boolean {
	if (typeof w === "object" && w !== null && "when" in w) {
		const o = w as Record<string, unknown>;
		if ("instant" in o) return readWhen(o["when"]);
	}
	if (isSignal(w)) return Boolean((w as Signal<unknown>)());
	if (typeof w === "function") return Boolean((w as () => unknown)());
	return Boolean(w);
}
