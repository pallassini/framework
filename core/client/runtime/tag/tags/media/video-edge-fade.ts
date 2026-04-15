import { onNodeDispose } from "../../../logic/lifecycle";
import { watch } from "../../../../state/effect";
import { styleViewport } from "../../../../style/viewport";

/** Default holding: 7% orizzontale, 10% verticale per lato. */
const DEFAULT_H = 7;
const DEFAULT_V = 10;

export type VideoEdgeFadeOptions = {
	/**
	 * Moltiplicatore sulle basi orizzontale/verticale (valori espliciti o default 7 / 10).
	 * Esempio `{ horizontal: 6, vertical: 10, strength: 2 }` → 12% e 20% prima del clamp.
	 */
	strength?: number;
	/** Base % per lato sinistro/destro (default 7 se omesso). */
	horizontal?: number;
	/** Base % per lato alto/basso (default 10 se omesso). */
	vertical?: number;
};

export type VideoEdgeFadeInput = boolean | VideoEdgeFadeOptions;

function clampPct(n: number): number {
	if (!Number.isFinite(n)) return 0;
	return Math.min(48, Math.max(0, n));
}

export function resolveVideoEdgeFadePercents(input: true | VideoEdgeFadeOptions): { h: number; v: number } {
	if (input === true) return { h: DEFAULT_H, v: DEFAULT_V };
	const mult = input.strength ?? 1;
	const baseH = input.horizontal ?? DEFAULT_H;
	const baseV = input.vertical ?? DEFAULT_V;
	return { h: clampPct(baseH * mult), v: clampPct(baseV * mult) };
}

/**
 * Due gradienti (H + V) con `mask-composite: intersect`, come holding `client/routes/index.tsx`.
 */
function maskImageValue(h: number, v: number): string {
	const maskH = `linear-gradient(to right, transparent 0%, black ${h}%, black ${100 - h}%, transparent 100%)`;
	const maskV = `linear-gradient(to bottom, transparent 0%, black ${v}%, black ${100 - v}%, transparent 100%)`;
	return `${maskH}, ${maskV}`;
}

function paintVideoEdgeFade(el: HTMLElement, h: number, v: number): void {
	const img = maskImageValue(h, v);
	el.style.maskImage = img;
	el.style.webkitMaskImage = img;
	el.style.maskRepeat = "no-repeat, no-repeat";
	el.style.webkitMaskRepeat = "no-repeat, no-repeat";
	el.style.maskSize = "100% 100%, 100% 100%";
	el.style.webkitMaskSize = "100% 100%, 100% 100%";
	el.style.maskComposite = "intersect";
	/** WebKit: come holding, `source-in` al posto di `intersect`. */
	el.style.webkitMaskComposite = "source-in";
}

type Entry = { stop: () => void; h: number; v: number };

const registry = new WeakMap<HTMLElement, Entry>();

export function applyVideoEdgeFade(
	el: HTMLElement,
	input: true | VideoEdgeFadeOptions,
	opts?: { registerDispose?: boolean },
): void {
	const { h, v } = resolveVideoEdgeFadePercents(input);
	clearVideoEdgeFade(el);
	const stop = watch(() => {
		void styleViewport();
		paintVideoEdgeFade(el, h, v);
	});
	registry.set(el, { stop, h, v });
	paintVideoEdgeFade(el, h, v);
	if (opts?.registerDispose !== false) {
		onNodeDispose(el, () => {
			clearVideoEdgeFade(el);
		});
	}
}

export function clearVideoEdgeFade(el: HTMLElement): void {
	const e = registry.get(el);
	if (!e) return;
	e.stop();
	registry.delete(el);
	el.style.removeProperty("mask-image");
	el.style.removeProperty("-webkit-mask-image");
	el.style.removeProperty("mask-repeat");
	el.style.removeProperty("-webkit-mask-repeat");
	el.style.removeProperty("mask-size");
	el.style.removeProperty("-webkit-mask-size");
	el.style.removeProperty("mask-composite");
	el.style.removeProperty("-webkit-mask-composite");
}

export function flushVideoEdgeFadeAfterStyle(el: HTMLElement): void {
	const e = registry.get(el);
	if (e) paintVideoEdgeFade(el, e.h, e.v);
}
