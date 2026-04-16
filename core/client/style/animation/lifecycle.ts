import type { AnimationTimelineLayer } from "./animations";

export type AnimationLifecycleBinding = Pick<AnimationTimelineLayer, "name" | "onStart" | "onEnd">;

const cleanups = new WeakMap<Element, () => void>();

function matchesAnimName(eventName: string, layerName: string): boolean {
	return eventName === layerName || eventName === `webkit-${layerName}`;
}

/** Rimuove listener registrati da {@link syncAnimationLifecycle}. */
export function clearAnimationLifecycle(el: Element): void {
	const d = cleanups.get(el);
	if (d) {
		d();
		cleanups.delete(el);
	}
}

/**
 * Collega `onStart` / `onEnd` ai nomi `@keyframes` effettivi (`animationName` negli eventi).
 * Chiamare dopo aver applicato lo stile; rieseguire se cambia la lista di animazioni.
 */
export function syncAnimationLifecycle(el: Element, bindings: ReadonlyArray<AnimationLifecycleBinding>): void {
	clearAnimationLifecycle(el);
	if (!bindings.length) return;

	const relevant = bindings.filter((b) => b.onStart != null || b.onEnd != null);
	if (!relevant.length) return;

	const onStart = (ev: AnimationEvent) => {
		if (ev.target !== el) return;
		const n = ev.animationName;
		for (const b of relevant) {
			if (b.onStart && matchesAnimName(n, b.name)) b.onStart();
		}
	};
	const onEnd = (ev: AnimationEvent) => {
		if (ev.target !== el) return;
		const n = ev.animationName;
		for (const b of relevant) {
			if (b.onEnd && matchesAnimName(n, b.name)) b.onEnd();
		}
	};

	el.addEventListener("animationstart", onStart);
	el.addEventListener("animationend", onEnd);
	cleanups.set(el, () => {
		el.removeEventListener("animationstart", onStart);
		el.removeEventListener("animationend", onEnd);
	});
}
