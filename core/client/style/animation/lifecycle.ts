import type { AnimationTimelineLayer } from "./animations";
import { fwLifecycleDebugLog } from "./debug-log";

export type AnimationLifecycleBinding = Pick<AnimationTimelineLayer, "name" | "onStart" | "onEnd"> & {
	/**
	 * Ms dall’applicazione dello stile alla fine del segmento: `delayMs + durationMs × iterazioni`.
	 * Usato per `onEnd` via `setTimeout` (catene `animation-*` multiple: `animationend` può essere anticipato o fuori ordine).
	 */
	endAfterMs?: number;
};

/** Calcola la scadenza per `onEnd` dal layer timeline; `undefined` se niente `onEnd` o iterazione infinita. */
export function animationLayerEndAfterMs(
	l: Pick<AnimationTimelineLayer, "delayMs" | "durationMs" | "iteration" | "onEnd">,
): number | undefined {
	if (l.onEnd == null) return undefined;
	if (l.iteration === "infinite") return undefined;
	const n = typeof l.iteration === "number" && l.iteration > 0 ? l.iteration : 1;
	return l.delayMs + l.durationMs * n;
}

const cleanups = new WeakMap<Element, () => void>();

function normalizeAnimationEventName(raw: string): string {
	let n = raw.trim();
	if (
		(n.startsWith('"') && n.endsWith('"')) ||
		(n.startsWith("'") && n.endsWith("'"))
	) {
		n = n.slice(1, -1).trim();
	}
	return n;
}

function matchesAnimName(eventName: string, layerName: string): boolean {
	const n = normalizeAnimationEventName(eventName);
	const L = layerName.trim();
	return n === L || n === `webkit-${L}`;
}

/** Rimuove listener registrati da {@link syncAnimationLifecycle}. */
export function clearAnimationLifecycle(el: Element): void {
	const d = cleanups.get(el);
	if (d) {
		fwLifecycleDebugLog("clearAnimationLifecycle", { tag: el.tagName, hadListeners: true });
		d();
		cleanups.delete(el);
	}
}

/**
 * Collega `onStart` / `onEnd` ai nomi `@keyframes` effettivi (`animationName` negli eventi).
 * Chiamare dopo aver applicato lo stile; rieseguire se cambia la lista di animazioni.
 * Con `endAfterMs`, `onEnd` usa sempre `setTimeout` (anche con reduced-motion sul CSS, altrimenti `animationend` sarebbe quasi immediato).
 */
export function syncAnimationLifecycle(el: Element, bindings: ReadonlyArray<AnimationLifecycleBinding>): void {
	clearAnimationLifecycle(el);
	if (!bindings.length) {
		fwLifecycleDebugLog("syncAnimationLifecycle (empty bindings)", { tag: el.tagName });
		return;
	}

	const relevant = bindings.filter((b) => b.onStart != null || b.onEnd != null);
	if (!relevant.length) {
		fwLifecycleDebugLog("syncAnimationLifecycle (no hooks)", { tag: el.tagName, raw: bindings.length });
		return;
	}

	const reduceMotion =
		typeof globalThis !== "undefined" &&
		typeof globalThis.matchMedia === "function" &&
		globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches;

	fwLifecycleDebugLog("syncAnimationLifecycle", {
		tag: el.tagName,
		reduceMotion,
		relevant: relevant.map((b) => ({
			name: b.name.length > 56 ? `${b.name.slice(0, 56)}…` : b.name,
			endAfterMs: b.endAfterMs,
			onEndUsesTimer: b.onEnd != null && b.endAfterMs != null && Number.isFinite(b.endAfterMs),
			hasOnStart: b.onStart != null,
		})),
	});

	const timeoutIds: ReturnType<typeof globalThis.setTimeout>[] = [];

	const onStart = (ev: AnimationEvent) => {
		if (ev.target !== el) return;
		if (ev.pseudoElement) return;
		const n = ev.animationName;
		fwLifecycleDebugLog("animationstart event", {
			animationName: n,
			elapsedTime: ev.elapsedTime,
		});
		for (const b of relevant) {
			if (b.onStart && matchesAnimName(n, b.name)) {
				fwLifecycleDebugLog("onStart CALLBACK (event)", { matched: b.name.slice(0, 48) });
				b.onStart();
			}
		}
	};
	const onEnd = (ev: AnimationEvent) => {
		if (ev.target !== el) return;
		if (ev.pseudoElement) return;
		const n = ev.animationName;
		for (const b of relevant) {
			if (!b.onEnd) continue;
			const useTimer = b.endAfterMs != null && Number.isFinite(b.endAfterMs);
			if (useTimer) continue;
			if (matchesAnimName(n, b.name)) {
				fwLifecycleDebugLog("onEnd CALLBACK (animationend)", {
					animationName: n,
					elapsedTime: ev.elapsedTime,
					matched: b.name.slice(0, 48),
				});
				b.onEnd();
			}
		}
	};

	for (const b of relevant) {
		if (!b.onEnd) continue;
		const useTimer = b.endAfterMs != null && Number.isFinite(b.endAfterMs);
		if (useTimer) {
			const delay = b.endAfterMs!;
			const label = b.name.length > 40 ? `${b.name.slice(0, 40)}…` : b.name;
			fwLifecycleDebugLog("schedule onEnd setTimeout", { name: label, delayMs: delay });
			const id = globalThis.setTimeout(() => {
				fwLifecycleDebugLog("onEnd CALLBACK (timer)", { name: label, delayMs: delay });
				b.onEnd!();
			}, delay);
			timeoutIds.push(id);
		} else if (b.onEnd != null) {
			fwLifecycleDebugLog("onEnd has no endAfterMs — using animationend only", {
				name: b.name.slice(0, 48),
			});
		}
	}

	el.addEventListener("animationstart", onStart as EventListener);
	el.addEventListener("animationend", onEnd as EventListener);
	cleanups.set(el, () => {
		fwLifecycleDebugLog("clearAnimationLifecycle cleanup run", {
			tag: el.tagName,
			clearTimeoutCount: timeoutIds.length,
		});
		for (const id of timeoutIds) globalThis.clearTimeout(id);
		el.removeEventListener("animationstart", onStart as EventListener);
		el.removeEventListener("animationend", onEnd as EventListener);
	});
}
