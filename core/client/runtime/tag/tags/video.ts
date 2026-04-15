import { toNodes } from "../../logic/children";
import { applyDomProps } from "../../logic/dom-props";
import { onNodeDispose } from "../../logic/lifecycle";
import { watch } from "../../../state/effect";
import type { DomProps, SharedProps, UiNode } from "../props";
import { applyMediaBlendEffect, clearMediaBlend, type MediaBlendLevel } from "./media/blend";
import { applyVideoEdgeFade, clearVideoEdgeFade, type VideoEdgeFadeOptions } from "./media/video-edge-fade";

export type VideoProps = SharedProps & {
	src: string;
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
};

function dimCss(v: number | string): string {
	return typeof v === "number" ? `${v}px` : String(v);
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
		...rest
	} = props;

	if (playsinline !== false) el.playsInline = true;

	applyDomProps(el, { ...rest, src, children: undefined } as DomProps);
	el.src = src;

	if (disablePictureInPicture !== false) {
		el.disablePictureInPicture = true;
		const cl = el.getAttribute("controlsList") ?? "";
		const tokens = new Set(cl.split(/\s+/).filter(Boolean));
		tokens.add("nopictureinpicture");
		el.setAttribute("controlsList", [...tokens].join(" "));
	}

	const wantAutoplay = props.autoplay === true;
	if (wantAutoplay && props.muted !== false) el.muted = true;
	if (props.preload == null) el.preload = wantAutoplay ? "auto" : "metadata";

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

	if (wantAutoplay) {
		const tryPlay = () => {
			void el.play().catch(() => {});
		};
		el.addEventListener("loadeddata", tryPlay, { once: true });
		el.addEventListener("canplay", tryPlay, { once: true });
		queueMicrotask(tryPlay);
	}

	applyVideoSize(el, width, height);
	const nodes = toNodes(children);
	if (nodes.length) el.append(...nodes);
	return el;
}
