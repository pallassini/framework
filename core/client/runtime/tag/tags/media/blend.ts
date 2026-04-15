import { onNodeDispose } from "../../../logic/lifecycle";
import { watch } from "../../../../state/effect";
import { styleViewport } from "../../../../style/viewport";

export type MediaBlendLevel = boolean | "soft" | "normal" | "strong" | "ultra";

type BlendEntry = { level: MediaBlendLevel; stop: () => void };

const registry = new WeakMap<HTMLElement, BlendEntry>();

function blendLevelNorm(blend: MediaBlendLevel): "soft" | "normal" | "strong" | "ultra" {
	return blend === true ? "normal" : blend;
}

/** Stesso effetto DOM di frameworkMappazzone `applyMediaBlendEffect` / `apply()`. */
export function paintMediaBlend(el: HTMLElement, blend: MediaBlendLevel): void {
	const blendLevel = blendLevelNorm(blend);
	el.style.mixBlendMode = "screen";
	el.style.backgroundColor = "transparent";
	if (blendLevel === "soft") {
		el.style.filter = "contrast(1.08) brightness(0.98)";
	} else if (blendLevel === "strong") {
		el.style.filter = "contrast(1.22)";
	} else if (blendLevel === "ultra") {
		el.style.filter = "contrast(1.34) brightness(1.08)";
	} else {
		el.style.filter = "contrast(1.12)";
	}
}

/**
 * Come Mappazzone: `effect` su `viewportSignal` / qui `watch` su `styleViewport`.
 * Dopo ogni `applyStyle` il motore riscrive gli inline style: serve `flushMediaBlendAfterStyle`
 * (chiamato da `applyFromResolved`) per rimettere blend **sempre dopo** `s`.
 */
export function applyMediaBlendEffect(el: HTMLElement, blend: MediaBlendLevel): void {
	clearMediaBlend(el);
	const level = blend;
	const stop = watch(() => {
		void styleViewport();
		paintMediaBlend(el, level);
	});
	registry.set(el, { level, stop });
	paintMediaBlend(el, level);
	onNodeDispose(el, () => {
		clearMediaBlend(el);
	});
}

export function clearMediaBlend(el: HTMLElement): void {
	const e = registry.get(el);
	if (!e) return;
	e.stop();
	registry.delete(el);
}

/** Chiamare subito dopo aver applicato gli stili da `s` (stesso ruolo del secondo `effect` in Mappazzone). */
export function flushMediaBlendAfterStyle(el: HTMLElement): void {
	const e = registry.get(el);
	if (e) paintMediaBlend(el, e.level);
}
