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

/**
 * Se `read()` è `true`, wheel/touch non aggiornano lo scroll (es. intro a schermo intero).
 * `undefined` disattiva il lock.
 */
let smoothScrollInteractionLock: (() => boolean) | undefined;

export function setSmoothScrollInteractionLock(read: (() => boolean) | undefined): void {
	smoothScrollInteractionLock = read;
}

function isSmoothScrollInteractionLocked(): boolean {
	return smoothScrollInteractionLock?.() ?? false;
}

export type SmoothScrollTune = {
	/** Damping strength (higher = snappier). Default `0.11` (~Lenis). */
	lerp?: number;
	/** Wheel delta scale. Default `0.78`. */
	wheelMultiplier?: number;
	/** Touch delta scale. Default `0.85`. */
	touchMultiplier?: number;
	/**
	 * Distanza (px) dal target entro cui l’inerzia si ammorbidisce (ease-out).
	 * Più alto = rampa più lunga (solo con `easeOutLerpMin < 1`). Default `420`.
	 */
	easeOutRange?: number;
	/**
	 * Moltiplicatore minimo del `lerp` quando si è vicini al target (`0`–`1`).
	 * `1` = disattivato (comportamento tipo Lenis: solo smorzamento esponenziale). Default `1`.
	 */
	easeOutLerpMin?: number;
	/**
	 * Curva sulla distanza in `easeOutRange`: `>1` sposta parte del rallentamento “più in alto” (meno tutto in coda).
	 * Usato solo se `easeOutLerpMin < 1`. Default `1.22`.
	 */
	easeOutGamma?: number;
};

/** `false` off; `true` or `{}` defaults; object merges with defaults. `undefined` → on with defaults. */
export type SmoothScrollConfig = false | true | SmoothScrollTune;

/** Vicino a Lenis (un solo lerp, niente frenata extra in coda). */
const DEFAULT_LERP = 0.11;
const DEFAULT_WHEEL_MULT = 0.78;
const DEFAULT_TOUCH_MULT = 0.85;
const DEFAULT_EASE_OUT_RANGE = 420;
/** `1` = curve easing extra disabilitata (come la maggior parte dei siti con Lenis). */
const DEFAULT_EASE_OUT_LERP_MIN = 1;
const DEFAULT_EASE_OUT_GAMMA = 1.22;

function clamp(v: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, v));
}

/** Same damping style used in many smooth-scroll engines (frame-rate independent). */
function damp(current: number, target: number, lambda: number, dtSeconds: number): number {
	return target + (current - target) * Math.exp(-lambda * dtSeconds);
}

function resolveTune(
	config: SmoothScrollConfig | undefined,
): {
	lerp: number;
	wheelMultiplier: number;
	touchMultiplier: number;
	easeOutRange: number;
	easeOutLerpMin: number;
	easeOutGamma: number;
} | null {
	if (config === false) return null;
	if (config === true || config === undefined) {
		return {
			lerp: DEFAULT_LERP,
			wheelMultiplier: DEFAULT_WHEEL_MULT,
			touchMultiplier: DEFAULT_TOUCH_MULT,
			easeOutRange: DEFAULT_EASE_OUT_RANGE,
			easeOutLerpMin: DEFAULT_EASE_OUT_LERP_MIN,
			easeOutGamma: DEFAULT_EASE_OUT_GAMMA,
		};
	}
	return {
		lerp: config.lerp ?? DEFAULT_LERP,
		wheelMultiplier: config.wheelMultiplier ?? DEFAULT_WHEEL_MULT,
		touchMultiplier: config.touchMultiplier ?? DEFAULT_TOUCH_MULT,
		easeOutRange: config.easeOutRange ?? DEFAULT_EASE_OUT_RANGE,
		easeOutLerpMin: config.easeOutLerpMin ?? DEFAULT_EASE_OUT_LERP_MIN,
		easeOutGamma: config.easeOutGamma ?? DEFAULT_EASE_OUT_GAMMA,
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

	const { lerp, wheelMultiplier, touchMultiplier, easeOutRange, easeOutLerpMin, easeOutGamma } = tune;

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
		if (isSmoothScrollInteractionLocked()) {
			if (rafId) {
				cancelAnimationFrame(rafId);
				rafId = 0;
			}
			if (window.scrollY !== 0) {
				ignoreNativeScroll = true;
				window.scrollTo(0, 0);
				ignoreNativeScroll = false;
			}
			current = 0;
			target = 0;
			return;
		}

		const dt = Math.max(0.001, (now - lastTime) / 1000);
		lastTime = now;

		const err = Math.abs(current - target);
		let lerpMult = 1;
		if (easeOutLerpMin < 1 - 1e-6 && easeOutRange > 0) {
			const easeT = Math.min(1, err / easeOutRange);
			const shaped = Math.pow(easeT, easeOutGamma);
			lerpMult = easeOutLerpMin + (1 - easeOutLerpMin) * shaped;
		}
		const next = damp(current, target, lerp * 60 * lerpMult, dt);
		const done = Math.abs(next - target) <= 0.35;

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
		if (isSmoothScrollInteractionLocked()) {
			if (e.cancelable) e.preventDefault();
			return;
		}
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
		if (isSmoothScrollInteractionLocked()) {
			if (e.cancelable) e.preventDefault();
			return;
		}
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
		if (isSmoothScrollInteractionLocked()) return;
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
