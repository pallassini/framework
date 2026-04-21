import { watch } from "../../../state/effect";
import { isSignal } from "../../../state/state";
import { onNodeDispose } from "../../logic/lifecycle";
import { readWhen } from "../../logic/read-when";

type El = HTMLElement | SVGElement;

/** `globalThis.__FW_SHOW_DEBUG__ = true` per log minimali in console. */
function showDebug(): boolean {
	try {
		return (globalThis as { __FW_SHOW_DEBUG__?: boolean }).__FW_SHOW_DEBUG__ === true;
	} catch {
		return false;
	}
}

function dbg(...parts: unknown[]): void {
	if (!showDebug()) return;
	console.log("[fw show]", ...parts);
}

function prefersReducedMotion(): boolean {
	return typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function parseTransitionDurationMaxMs(raw: string): number {
	let max = 0;
	for (const part of raw.split(",")) {
		const p = part.trim();
		if (!p || p === "0s") continue;
		if (p.endsWith("ms")) max = Math.max(max, parseFloat(p) || 0);
		else if (p.endsWith("s")) max = Math.max(max, (parseFloat(p) || 0) * 1000);
	}
	return max;
}

/** Max `transition-duration` when multiple properties transition (comma-separated). */
function maxTransitionDurationMs(el: El): number {
	if (prefersReducedMotion()) return 0;
	const raw = getComputedStyle(el).transitionDuration;
	let max = parseTransitionDurationMaxMs(raw);
	if (max === 0) {
		const rootRaw = getComputedStyle(document.documentElement).transitionDuration;
		max = parseTransitionDurationMaxMs(rootRaw);
		if (max > 0) dbg("dur ← :root", max, "ms", el.tagName);
	}
	if (max === 0) {
		max = 300;
		dbg("dur fallback 300ms", el.tagName);
	}
	return max;
}

function isSvgOnly(el: El): el is SVGElement {
	return el instanceof SVGElement && !(el instanceof HTMLElement);
}

function clearAnimStyles(el: El): void {
	if (isSvgOnly(el)) {
		el.style.removeProperty("opacity");
		return;
	}
	const h = el;
	h.style.removeProperty("max-width");
	h.style.removeProperty("opacity");
	h.style.removeProperty("overflow");
	h.style.removeProperty("white-space");
	h.style.removeProperty("transition-property");
	h.style.removeProperty("transition-duration");
	h.style.removeProperty("transition-timing-function");
}

/** Se il nodo non eredita durata utile (es. span senza `transition-duration`), allinea a `:root`. */
function ensureShowTransition(html: HTMLElement): void {
	if (parseTransitionDurationMaxMs(getComputedStyle(html).transitionDuration) > 0) return;
	const d = getComputedStyle(document.documentElement).transitionDuration;
	const tf = getComputedStyle(document.documentElement).transitionTimingFunction;
	if (d && d !== "0s") {
		html.style.transitionProperty = "max-width, opacity";
		html.style.transitionDuration = d;
		if (tf) html.style.transitionTimingFunction = tf;
	}
}

function collapseUsesNowrap(el: HTMLElement): boolean {
	const d = getComputedStyle(el).display;
	return d === "inline" || d === "inline-block" || d === "inline-flex";
}

function readCollapseWidth(el: HTMLElement): number {
	let w = Math.ceil(el.offsetWidth);
	if (w <= 0) w = Math.ceil(el.scrollWidth);
	return w;
}

/** In contenitori stretti (flex / sidebar) `offsetWidth` può essere 0: misura fuori flusso. */
function measureUnconstrainedWidth(el: HTMLElement): number {
	const prev = {
		position: el.style.position,
		left: el.style.left,
		top: el.style.top,
		visibility: el.style.visibility,
		whiteSpace: el.style.whiteSpace,
		maxWidth: el.style.maxWidth,
	};

	el.style.position = "absolute";
	el.style.left = "-10000px";
	el.style.top = "0";
	el.style.visibility = "hidden";
	el.style.whiteSpace = "nowrap";
	el.style.maxWidth = "none";

	void el.offsetWidth;
	const w = Math.max(Math.ceil(el.offsetWidth), Math.ceil(el.scrollWidth));

	el.style.position = prev.position;
	el.style.left = prev.left;
	el.style.top = prev.top;
	el.style.visibility = prev.visibility;
	el.style.whiteSpace = prev.whiteSpace;
	el.style.maxWidth = prev.maxWidth;

	return w;
}

function naturalOpenWidth(el: HTMLElement): number {
	const w = readCollapseWidth(el);
	if (w > 0) return w;
	return measureUnconstrainedWidth(el);
}

/** Larghezza per chiusura: stesso fallback della misura in apertura. */
function leaveStartWidth(el: HTMLElement): number {
	let w = readCollapseWidth(el);
	if (w > 0) return w;
	return measureUnconstrainedWidth(el);
}

/**
 * Completa dopo la transione reale (`max-width` guida il layout) o fallback,
 * con rAF prima di smontare / togliere gli inline.
 */
function armTransitionComplete(
	html: HTMLElement,
	durationMs: number,
	stillValid: () => boolean,
	onComplete: () => void,
	label: string,
): () => void {
	let cleaned = false;
	let tid = 0;
	const t0 = performance.now();

	const cleanup = (): void => {
		if (cleaned) return;
		cleaned = true;
		html.removeEventListener("transitionend", onEnd);
		window.clearTimeout(tid);
	};

	const finish = (source: "transitionend" | "timeout"): void => {
		if (cleaned) return;
		const elapsed = Math.round(performance.now() - t0);
		dbg(label, source, elapsed + "ms", "~" + durationMs + "ms");
		cleanup();
		if (stillValid()) {
			requestAnimationFrame(() => {
				requestAnimationFrame(onComplete);
			});
		}
	};

	const onEnd = (ev: TransitionEvent): void => {
		if (cleaned || !stillValid()) return;
		if (ev.target !== html) return;
		if (ev.propertyName !== "max-width") return;
		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				finish("transitionend");
			});
		});
	};

	html.addEventListener("transitionend", onEnd);
	tid = window.setTimeout(() => finish("timeout"), durationMs + 150);

	return cleanup;
}

function armOpacityTransitionComplete(
	el: SVGElement,
	durationMs: number,
	stillValid: () => boolean,
	onComplete: () => void,
	label: string,
): () => void {
	let cleaned = false;
	let tid = 0;
	const t0 = performance.now();

	const cleanup = (): void => {
		if (cleaned) return;
		cleaned = true;
		el.removeEventListener("transitionend", onEnd);
		window.clearTimeout(tid);
	};

	const finish = (source: "transitionend" | "timeout"): void => {
		if (cleaned) return;
		dbg(label, source, Math.round(performance.now() - t0) + "ms");
		cleanup();
		if (stillValid()) {
			requestAnimationFrame(() => {
				requestAnimationFrame(onComplete);
			});
		}
	};

	const onEnd = (ev: TransitionEvent): void => {
		if (cleaned || !stillValid()) return;
		if (ev.target !== el) return;
		if (ev.propertyName !== "opacity") return;
		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				finish("transitionend");
			});
		});
	};

	el.addEventListener("transitionend", onEnd);
	tid = window.setTimeout(() => finish("timeout"), durationMs + 150);

	return cleanup;
}

type ShowCtl = {
	setWhen: (v: unknown) => void;
};

const showControllers = new WeakMap<El, ShowCtl>();

/**
 * Prop `show`: mount/unmount nel DOM con transizione allineata a `transition` / `var(--duration)` dell’elemento
 * (vedi `base-reset.ts`). HTML: `opacity` + `max-width`; SVG: solo `opacity`.
 *
 * `applyDomProps` può richiamare la prop più volte: **un solo controller per elemento** (WeakMap).
 */
function attachShowController(el: El, initialV: unknown): void {
	const whenRef: { v: unknown } = { v: initialV };

	dbg(
		"attach",
		el.tagName,
		isSignal(initialV) ? "signal" : typeof initialV === "function" ? "fn" : typeof initialV,
		readWhen(initialV) ? "on" : "off",
	);

	const placeholder = document.createComment("");
	let mounted = true;
	let rafId = 0;
	let queued = false;
	let needsColdEnter = true;

	let enterCycle = 0;
	let leaveCycle = 0;
	let enterCleanup: (() => void) | null = null;
	let leaveCleanup: (() => void) | null = null;

	let stopWatch: () => void = () => {};

	const cancelEnter = (): void => {
		if (enterCleanup) {
			enterCleanup();
			enterCleanup = null;
		}
		enterCycle++;
	};

	const cancelLeave = (): void => {
		if (!leaveCleanup) return;
		leaveCleanup();
		leaveCleanup = null;
		leaveCycle++;
		clearAnimStyles(el);
	};

	const startEnter = (): void => {
		cancelEnter();
		const my = ++enterCycle;
		const dur = maxTransitionDurationMs(el);
		if (dur === 0) {
			clearAnimStyles(el);
			dbg("enter skip dur=0");
			return;
		}

		if (isSvgOnly(el)) {
			clearAnimStyles(el);
			el.style.opacity = "0";
			void el.getBoundingClientRect();
			requestAnimationFrame(() => {
				if (my !== enterCycle) return;
				el.style.opacity = "1";
				enterCleanup = armOpacityTransitionComplete(
					el,
					dur,
					() => my === enterCycle,
					() => {
						if (my !== enterCycle) return;
						enterCleanup = null;
						clearAnimStyles(el);
					},
					"enter svg",
				);
			});
			dbg("enter svg", dur + "ms");
			return;
		}

		const html = el;
		const run = (attempt: number): void => {
			if (my !== enterCycle) return;
			if (!html.isConnected) {
				if (attempt < 12) {
					requestAnimationFrame(() => run(attempt + 1));
					return;
				}
				dbg("enter abort !connected");
				return;
			}
			const naturalW = naturalOpenWidth(html);
			if (naturalW <= 0) {
				if (attempt < 12) {
					requestAnimationFrame(() => run(attempt + 1));
					return;
				}
				dbg("enter abort w=0");
				return;
			}

			clearAnimStyles(html);
			ensureShowTransition(html);
			html.style.overflow = "hidden";
			if (collapseUsesNowrap(html)) html.style.whiteSpace = "nowrap";
			html.style.maxWidth = "0px";
			html.style.opacity = "0";
			void html.offsetWidth;

			requestAnimationFrame(() => {
				if (my !== enterCycle) return;
				html.style.maxWidth = `${naturalW}px`;
				html.style.opacity = "1";

				enterCleanup = armTransitionComplete(
					html,
					dur,
					() => my === enterCycle,
					() => {
						if (my !== enterCycle) return;
						enterCleanup = null;
						clearAnimStyles(html);
					},
					"enter",
				);
			});
		};

		run(0);
		dbg("enter →", dur + "ms");
	};

	const startLeave = (thenUnmount: () => void): void => {
		cancelLeave();
		const my = ++leaveCycle;
		const dur = maxTransitionDurationMs(el);
		if (dur === 0) {
			thenUnmount();
			return;
		}

		if (isSvgOnly(el)) {
			el.style.opacity = "0";
			leaveCleanup = armOpacityTransitionComplete(
				el,
				dur,
				() => my === leaveCycle,
				() => {
					if (my !== leaveCycle) return;
					leaveCleanup = null;
					thenUnmount();
				},
				"leave svg",
			);
			dbg("leave svg", dur + "ms");
			return;
		}

		const html = el;
		ensureShowTransition(html);
		const w = leaveStartWidth(html);
		if (w <= 0) {
			dbg("leave instant w=0");
			thenUnmount();
			return;
		}

		html.style.overflow = "hidden";
		if (collapseUsesNowrap(html)) html.style.whiteSpace = "nowrap";
		html.style.maxWidth = `${w}px`;
		void html.offsetWidth;
		html.style.maxWidth = "0px";
		html.style.opacity = "0";

		leaveCleanup = armTransitionComplete(
			html,
			dur,
			() => my === leaveCycle,
			() => {
				if (my !== leaveCycle) return;
				leaveCleanup = null;
				thenUnmount();
			},
			"leave",
		);
		dbg("leave →", w + "px", dur + "ms");
	};

	const sync = (): void => {
		const active = readWhen(whenRef.v);
		if (active) {
			cancelLeave();
			if (!mounted) {
				if (placeholder.parentNode) {
					placeholder.replaceWith(el);
					mounted = true;
					needsColdEnter = false;
					dbg("show on (placeholder)");
					startEnter();
				}
			} else if (needsColdEnter && el.parentNode) {
				needsColdEnter = false;
				dbg("show on (cold)");
				startEnter();
			}
		} else {
			needsColdEnter = true;
			cancelEnter();
			if (mounted) {
				if (el.parentNode) {
					dbg("show off");
					startLeave(() => {
						if (readWhen(whenRef.v)) return;
						if (el.parentNode) el.replaceWith(placeholder);
						mounted = false;
					});
				}
			}
		}
	};

	function bindWatch(): void {
		stopWatch();
		stopWatch = watch(() => {
			readWhen(whenRef.v);
			sync();
			if (queued) return;
			queued = true;
			queueMicrotask(() => {
				queued = false;
				sync();
				if (rafId) cancelAnimationFrame(rafId);
				rafId = requestAnimationFrame(() => {
					rafId = 0;
					sync();
				});
			});
			return () => {
				if (rafId) cancelAnimationFrame(rafId);
				rafId = 0;
				queued = false;
			};
		});
	}

	bindWatch();

	const disposeAll = (): void => {
		stopWatch();
		if (rafId) cancelAnimationFrame(rafId);
		rafId = 0;
		queued = false;
		cancelEnter();
		cancelLeave();
		showControllers.delete(el);
	};

	onNodeDispose(el, disposeAll);

	showControllers.set(el, {
		setWhen(next: unknown) {
			if (Object.is(whenRef.v, next)) return;
			dbg("show prop ref changed");
			whenRef.v = next;
			stopWatch();
			bindWatch();
		},
	});
}

export function show(el: El, v: unknown): void {
	let ctl = showControllers.get(el);
	if (ctl) {
		ctl.setWhen(v);
		return;
	}
	attachShowController(el, v);
}
