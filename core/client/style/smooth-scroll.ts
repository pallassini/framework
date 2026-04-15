/**
 * Lenis-like smooth scroll without external dependencies.
 * - Intercepts wheel/touch and animates toward a target scroll position.
 * - Keeps native scrollbar drag/click working (sync from native scroll events).
 * - Skips nested scrollable containers.
 */

declare global {
	interface Window {
		__flowSmoothScrollDestroy__?: () => void;
	}
}

export type SmoothScrollTune = {
	/** Damping strength (higher = snappier). Default `0.14`. */
	lerp?: number;
	/** Wheel delta scale. Default `0.75`. */
	wheelMultiplier?: number;
	/** Touch delta scale. Default `0.85`. */
	touchMultiplier?: number;
};

/** `false` off; `true` or `{}` defaults; object merges with defaults. `undefined` → on with defaults. */
export type SmoothScrollConfig = false | true | SmoothScrollTune;

const DEFAULT_LERP = 0.14;
const DEFAULT_WHEEL_MULT = 0.75;
const DEFAULT_TOUCH_MULT = 0.85;

function clamp(v: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, v));
}

/** Same damping style used in many smooth-scroll engines (frame-rate independent). */
function damp(current: number, target: number, lambda: number, dtSeconds: number): number {
	return target + (current - target) * Math.exp(-lambda * dtSeconds);
}

function resolveTune(config: SmoothScrollConfig | undefined): { lerp: number; wheelMultiplier: number; touchMultiplier: number } | null {
	if (config === false) return null;
	if (config === true || config === undefined) {
		return {
			lerp: DEFAULT_LERP,
			wheelMultiplier: DEFAULT_WHEEL_MULT,
			touchMultiplier: DEFAULT_TOUCH_MULT,
		};
	}
	return {
		lerp: config.lerp ?? DEFAULT_LERP,
		wheelMultiplier: config.wheelMultiplier ?? DEFAULT_WHEEL_MULT,
		touchMultiplier: config.touchMultiplier ?? DEFAULT_TOUCH_MULT,
	};
}

/**
 * Applies smooth scroll from `clientConfig.style.smoothScroll`.
 * Call again after navigation if needed; previous instance is torn down first.
 */
export function initSmoothScroll(config: SmoothScrollConfig | undefined): void {
	if (typeof window === "undefined") return;

	window.__flowSmoothScrollDestroy__?.();

	const tune = resolveTune(config);
	if (!tune) return;

	if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

	const { lerp, wheelMultiplier, touchMultiplier } = tune;

	let current = window.scrollY;
	let target = window.scrollY;
	let rafId = 0;
	let lastTime = 0;
	let ignoreNativeScroll = false;
	let ignoreNativeUntil = 0;

	let touchLastY = 0;
	let touchVelocity = 0;
	let touchLastTs = 0;

	function getLimit(): number {
		return Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
	}

	function clampTarget(v: number): number {
		return clamp(v, 0, getLimit());
	}

	function isInsideScrollable(el: HTMLElement | null): boolean {
		let node = el;
		while (node && node !== document.body) {
			const cs = window.getComputedStyle(node);
			const canScrollY =
				(cs.overflowY === "auto" || cs.overflowY === "scroll") && node.scrollHeight > node.clientHeight + 1;
			if (canScrollY) return true;
			node = node.parentElement;
		}
		return false;
	}

	function requestTick(): void {
		if (!rafId) {
			lastTime = performance.now();
			rafId = requestAnimationFrame(tick);
		}
	}

	function tick(now: number): void {
		const dt = Math.max(0.001, (now - lastTime) / 1000);
		lastTime = now;

		const next = damp(current, target, lerp * 60, dt);
		const done = Math.abs(next - target) <= 0.2;

		current = done ? target : next;

		ignoreNativeScroll = true;
		ignoreNativeUntil = performance.now() + 34;
		window.scrollTo(0, current);
		ignoreNativeScroll = false;

		if (done) {
			rafId = 0;
			return;
		}
		rafId = requestAnimationFrame(tick);
	}

	function onNativeScroll(): void {
		if (ignoreNativeScroll || performance.now() < ignoreNativeUntil) return;
		current = window.scrollY;
		target = window.scrollY;
		if (rafId) {
			cancelAnimationFrame(rafId);
			rafId = 0;
		}
	}

	function onWheel(e: WheelEvent): void {
		if (e.ctrlKey) return;
		const el = e.target instanceof HTMLElement ? e.target : null;
		if (isInsideScrollable(el)) return;
		if (e.cancelable) e.preventDefault();
		target = clampTarget(target + e.deltaY * wheelMultiplier);
		requestTick();
	}

	function onTouchStart(e: TouchEvent): void {
		const t = e.touches[0];
		if (!t) return;
		touchLastY = t.clientY;
		touchLastTs = performance.now();
		touchVelocity = 0;
	}

	function onTouchMove(e: TouchEvent): void {
		const t = e.touches[0];
		if (!t) return;
		const el = e.target instanceof HTMLElement ? e.target : null;
		if (isInsideScrollable(el)) return;
		const dy = touchLastY - t.clientY;
		const now = performance.now();
		const dtMs = Math.max(1, now - touchLastTs);
		touchVelocity = (dy / dtMs) * 16.67;
		touchLastTs = now;
		touchLastY = t.clientY;

		if (e.cancelable) e.preventDefault();
		target = clampTarget(target + dy * touchMultiplier);
		requestTick();
	}

	function onTouchEnd(): void {
		const inertia = clamp(touchVelocity * 12, -220, 220);
		if (Math.abs(inertia) > 1) {
			target = clampTarget(target + inertia);
			requestTick();
		}
	}

	function onResize(): void {
		target = clampTarget(target);
		current = clampTarget(current);
		requestTick();
	}

	window.addEventListener("scroll", onNativeScroll, { passive: true });
	window.addEventListener("wheel", onWheel, { passive: false });
	window.addEventListener("touchstart", onTouchStart, { passive: true });
	window.addEventListener("touchmove", onTouchMove, { passive: false });
	window.addEventListener("touchend", onTouchEnd, { passive: true });
	window.addEventListener("resize", onResize, { passive: true });

	window.__flowSmoothScrollDestroy__ = () => {
		if (rafId) cancelAnimationFrame(rafId);
		rafId = 0;
		window.removeEventListener("scroll", onNativeScroll);
		window.removeEventListener("wheel", onWheel);
		window.removeEventListener("touchstart", onTouchStart);
		window.removeEventListener("touchmove", onTouchMove);
		window.removeEventListener("touchend", onTouchEnd);
		window.removeEventListener("resize", onResize);
		delete window.__flowSmoothScrollDestroy__;
	};
}
