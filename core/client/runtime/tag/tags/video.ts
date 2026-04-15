import { toNodes } from "../../logic/children";
import { applyDomProps } from "../../logic/dom-props";
import type { DomProps, SharedProps, UiNode } from "../props";
import { applyMediaBlendEffect, type MediaBlendLevel } from "./media/blend";

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
	/** Video “luminoso” su sfondo scuro (`mix-blend-mode: screen` + contrasto). */
	blend?: MediaBlendLevel;
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

	if (blend) {
		el.style.objectFit = "cover";
		applyMediaBlendEffect(el, blend);
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
