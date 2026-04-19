import { toNodes } from "../../logic/children";
import { applyDomProps } from "../../logic/dom-props";
import { onNodeDispose } from "../../logic/lifecycle";
import { watch } from "../../../state/effect";
import { isSignal, type Signal } from "../../../state";
import type { DomProps, SharedProps, UiNode } from "../props";
import { applyMediaBlendEffect, clearMediaBlend, type MediaBlendLevel } from "./media/blend";
import { applyVideoEdgeFade, clearVideoEdgeFade, type VideoEdgeFadeOptions } from "./media/video-edge-fade";

export type VideoProps = SharedProps & {
	/** URL statico, oppure funzione/Signal reattivo (stesso elemento `<video>`, niente remount al cambio slide). */
	src: string | (() => string) | Signal<string>;
	poster?: string;
	width?: number | string;
	height?: number | string;
	preload?: "none" | "metadata" | "auto";
	controls?: boolean;
	autoplay?: boolean;
	muted?: boolean;
	loop?: boolean;
	playsinline?: boolean;
	/**
	 * Default `true`: disattiva Picture-in-Picture dove il browser lo supporta.
	 */
	disablePictureInPicture?: boolean;
	/**
	 * Video “luminoso” su sfondo scuro (`mix-blend-mode: screen` + contrasto).
	 * Funzione: utile per varianti viewport (es. `() => mob() ? "ultra" : true`).
	 */
	blend?: MediaBlendLevel | (() => MediaBlendLevel | false | null | undefined);
	/**
	 * Dissolvenza su tutti i bordi (maschera CSS come in holding: due gradienti + intersect).
	 * `true` = default (7% H / 10%). Oggetto: `strength` × (`horizontal`|`vertical` o default 7/10).
	 * Funzione: es. `() => mob() ? { strength: 2 } : false`.
	 */
	edgeFade?: boolean | VideoEdgeFadeOptions | (() => boolean | VideoEdgeFadeOptions | false | null | undefined);
	/**
	 * Con `blend`, default `cover` (taglia per riempire). `contain` mostra tutto il fotogramma (niente taglio orizzontale).
	 */
	objectFit?: "contain" | "cover" | "fill" | "none" | "scale-down";
	/**
	 * Velocità di riproduzione (`HTMLVideoElement.playbackRate`), es. `0.75`, `1`, `1.25`. Default: `1`.
	 */
	speed?: number;
	/**
	 * Se impostato, non chiama `play()` finché il segnale non è `true` (disattiva l’autoplay immediato su `loadeddata` / `canplay`).
	 */
	playWhen?: Signal<boolean>;
	/**
	 * Ritardo (ms) dell’entrata visiva (es. `delay` del primo `animate` su `opacity`); con `playLeadMs` la riproduzione parte prima del fade-in.
	 */
	playEnterDelayMs?: number;
	/**
	 * Anticipo (ms) rispetto a `playEnterDelayMs` (default 100). Ignorato se `playEnterDelayMs` non è impostato (allora `play()` parte appena `playWhen` è true).
	 */
	playLeadMs?: number;
};

function dimCss(v: number | string): string {
	return typeof v === "number" ? `${v}px` : String(v);
}

function readVideoSrc(src: string | (() => string) | Signal<string>): string {
	if (isSignal(src)) return String(src());
	if (typeof src === "function") return (src as () => string)();
	return String(src);
}

function applyVideoSize(el: HTMLVideoElement, width?: number | string, height?: number | string): void {
	const hasW = width != null;
	const hasH = height != null;
	if (!hasW && !hasH) return;
	if (hasW) el.style.width = dimCss(width!);
	else el.style.width = "auto";
	if (hasH) el.style.height = dimCss(height!);
	else el.style.height = "auto";
}

export function video(props: VideoProps): UiNode {
	const el = document.createElement("video");
	const {
		width,
		height,
		children,
		src,
		playsinline,
		blend,
		edgeFade,
		objectFit,
		disablePictureInPicture,
		playWhen,
		playEnterDelayMs,
		playLeadMs,
		autoplay,
		speed,
		...rest
	} = props;

	const srcReactive = isSignal(src) || typeof src === "function";
	const wantAutoplay = autoplay === true && playWhen == null;

	if (playsinline !== false) el.playsInline = true;

	if ((wantAutoplay || playWhen != null) && props.muted !== false) el.muted = true;
	if (props.preload == null) el.preload = wantAutoplay || playWhen != null ? "auto" : "metadata";

	applyDomProps(el, {
		...rest,
		...(srcReactive ? {} : { src }),
		autoplay: playWhen != null ? false : autoplay,
		children: undefined,
	} as DomProps);

	const applyPlaybackRate = (): void => {
		if (speed != null && Number.isFinite(speed) && speed > 0) el.playbackRate = speed;
	};

	const scheduleAutoplay = (): void => {
		if (!wantAutoplay) return;
		const tryPlay = (): void => {
			void el.play().catch(() => {});
		};
		el.addEventListener("loadeddata", tryPlay, { once: true });
		el.addEventListener("canplay", tryPlay, { once: true });
		queueMicrotask(tryPlay);
	};

	const bindReactiveSrc = (): void => {
		el.src = readVideoSrc(src);
		applyPlaybackRate();
		scheduleAutoplay();
	};

	if (srcReactive) {
		const stopSrc = watch(bindReactiveSrc, { flush: "sync" });
		onNodeDispose(el, stopSrc);
	} else {
		el.src = readVideoSrc(src);
		applyPlaybackRate();
	}

	if (disablePictureInPicture !== false) {
		el.disablePictureInPicture = true;
		const cl = el.getAttribute("controlsList") ?? "";
		const tokens = new Set(cl.split(/\s+/).filter(Boolean));
		tokens.add("nopictureinpicture");
		el.setAttribute("controlsList", [...tokens].join(" "));
	}

	const blendObjectFit = objectFit ?? "cover";

	if (typeof blend === "function") {
		const stopBlend = watch(() => {
			const b = blend();
			if (b == null || b === false) {
				clearMediaBlend(el);
				el.style.removeProperty("object-fit");
				if (objectFit != null) el.style.objectFit = objectFit;
			} else {
				el.style.objectFit = blendObjectFit;
				applyMediaBlendEffect(el, b, { registerDispose: false });
			}
		});
		onNodeDispose(el, () => {
			stopBlend();
			clearMediaBlend(el);
		});
	} else if (blend) {
		el.style.objectFit = blendObjectFit;
		applyMediaBlendEffect(el, blend);
	} else if (objectFit != null) {
		el.style.objectFit = objectFit;
	}

	if (typeof edgeFade === "function") {
		const stopEdge = watch(() => {
			const raw = edgeFade();
			if (raw == null || raw === false) clearVideoEdgeFade(el);
			else applyVideoEdgeFade(el, raw === true ? true : raw, { registerDispose: false });
		});
		onNodeDispose(el, () => {
			stopEdge();
			clearVideoEdgeFade(el);
		});
	} else if (edgeFade != null && edgeFade !== false) {
		applyVideoEdgeFade(el, edgeFade === true ? true : edgeFade);
	}

	if (playWhen != null) {
		let timeoutId: number | undefined;
		const lead = playLeadMs ?? 100;
		const stop = watch(() => {
			if (timeoutId != null) {
				clearTimeout(timeoutId);
				timeoutId = undefined;
			}
			if (!playWhen()) return;
			const ms =
				playEnterDelayMs != null ? Math.max(0, playEnterDelayMs - lead) : 0;
			timeoutId = window.setTimeout(() => {
				timeoutId = undefined;
				void el.play().catch(() => {});
			}, ms);
		});
		onNodeDispose(el, () => {
			stop();
			if (timeoutId != null) clearTimeout(timeoutId);
		});
	} else if (wantAutoplay && !srcReactive) {
		scheduleAutoplay();
	}

	applyVideoSize(el, width, height);
	const nodes = toNodes(children);
	if (nodes.length) el.append(...nodes);
	return el;
}
