import { onNodeDispose } from "../../../logic/lifecycle";
import { watch } from "../../../../state/effect";
import { styleViewport } from "../../../../style/viewport";

/** `natural`: solo `mix-blend-mode: screen`, niente `filter` (colori più fedeli al file). */
export type MediaBlendLevel = boolean | "natural" | "soft" | "normal" | "strong" | "ultra";

/** Opzioni per `applyMediaBlendEffect` / `paintMediaBlend`. */
export type ApplyMediaBlendOptions = {
	/**
	 * Default `true`. Su Chrome (soprattutto Android) `filter` + `mix-blend-mode` sullo stesso elemento
	 * spesso non compongono: imposta `false` e applica contrasto altrove (es. `ctx.filter` su canvas).
	 */
	elementFilter?: boolean;
	/**
	 * Default `true`. Se `false`, non registra `onNodeDispose` (blend pilotato da un `watch` esterno, es. `<video>`).
	 */
	registerDispose?: boolean;
};

type BlendEntry = { level: MediaBlendLevel; elementFilter: boolean; stop: () => void };

const registry = new WeakMap<HTMLElement, BlendEntry>();

function blendLevelNorm(blend: MediaBlendLevel): "natural" | "soft" | "normal" | "strong" | "ultra" {
	if (blend === true) return "normal";
	if (blend === "natural") return "natural";
	return blend;
}

/** Filtro Canvas2D equivalente al `filter` CSS di `paintMediaBlend` (con `elementFilter: true`). */
export function mediaBlendCanvasFilter(blend: MediaBlendLevel): string {
	const blendLevel = blendLevelNorm(blend);
	if (blendLevel === "natural") return "none";
	if (blendLevel === "soft") return "contrast(1.08) brightness(0.98)";
	if (blendLevel === "strong") return "contrast(1.22)";
	if (blendLevel === "ultra") return "contrast(1.34) brightness(1.08)";
	return "contrast(1.12)";
}

/** Stesso effetto DOM di frameworkMappazzone `applyMediaBlendEffect` / `apply()`. */
export function paintMediaBlend(
	el: HTMLElement,
	blend: MediaBlendLevel,
	opts?: Pick<ApplyMediaBlendOptions, "elementFilter">,
): void {
	const elementFilter = opts?.elementFilter !== false;
	const blendLevel = blendLevelNorm(blend);
	el.style.mixBlendMode = "screen";
	el.style.backgroundColor = "transparent";
	if (!elementFilter) {
		el.style.filter = "";
		return;
	}
	if (blendLevel === "natural") {
		el.style.filter = "";
		return;
	}
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
export function applyMediaBlendEffect(
	el: HTMLElement,
	blend: MediaBlendLevel,
	opts?: ApplyMediaBlendOptions,
): void {
	clearMediaBlend(el);
	const level = blend;
	const elementFilter = opts?.elementFilter !== false;
	const stop = watch(() => {
		void styleViewport();
		paintMediaBlend(el, level, { elementFilter });
	});
	registry.set(el, { level, elementFilter, stop });
	paintMediaBlend(el, level, { elementFilter });
	if (opts?.registerDispose !== false) {
		onNodeDispose(el, () => {
			clearMediaBlend(el);
		});
	}
}

export function clearMediaBlend(el: HTMLElement): void {
	const e = registry.get(el);
	if (e) {
		e.stop();
		registry.delete(el);
	}
	el.style.removeProperty("mix-blend-mode");
	el.style.removeProperty("filter");
	el.style.removeProperty("background-color");
}

/** Chiamare subito dopo aver applicato gli stili da `s` (stesso ruolo del secondo `effect` in Mappazzone). */
export function flushMediaBlendAfterStyle(el: HTMLElement): void {
	const e = registry.get(el);
	if (e) paintMediaBlend(el, e.level, { elementFilter: e.elementFilter });
}
