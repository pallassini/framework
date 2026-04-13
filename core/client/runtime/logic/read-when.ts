import { isSignal, type Signal } from "../../state/state";

export function readWhen(w: unknown): boolean {
	if (isSignal(w)) return Boolean((w as Signal<unknown>)());
	if (typeof w === "function") return Boolean((w as () => unknown)());
	return Boolean(w);
}
