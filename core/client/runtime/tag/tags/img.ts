import { applyDomProps } from "../../logic/dom-props";
import { toNodes } from "../../logic/children";
import { onNodeDispose } from "../../logic/lifecycle";
import type { DomProps, SharedProps, UiNode } from "../props";
import { watch } from "../../../state/effect";
import { isSignal, type Signal } from "../../../state";
import { applyMediaBlendEffect, type MediaBlendLevel } from "./media/blend";

export type ImgProps = SharedProps & {
	/**
	 * URL statico, oppure funzione / `Signal` reattivo (stesso `<img>`, aggiorna `src` al cambio).
	 * Nei file sotto `client/routes`, per asset `./file.png` usa `new URL("./file.png", import.meta.url).href`
	 * (o `src="./file.png"` letterale): altrimenti il plugin `route-asset-src` non risolve il path.
	 */
	src: string | (() => string) | Signal<string>;
	alt?: string;
	decoding?: HTMLImageElement["decoding"];
	loading?: HTMLImageElement["loading"];
	/** Come Mappazzone: `mix-blend-mode: screen` + contrasto. */
	blend?: MediaBlendLevel;
};

function readImgSrc(src: string | (() => string) | Signal<string>): string {
	if (isSignal(src)) return String(src());
	if (typeof src === "function") return (src as () => string)();
	return String(src);
}

export function img(props: ImgProps): UiNode {
	const el = document.createElement("img");
	const { src, alt, decoding, loading, children, blend, ...rest } = props;
	const srcReactive = isSignal(src) || typeof src === "function";

	if (srcReactive) {
		let last = "";
		const stop = watch(
			() => {
				const next = readImgSrc(src);
				if (!next || next === last) return;
				last = next;
				el.src = next;
			},
			{ flush: "sync" },
		);
		onNodeDispose(el, stop);
	} else {
		el.src = readImgSrc(src);
	}
	if (alt != null) el.alt = alt;
	if (decoding != null) el.decoding = decoding;
	if (loading != null) el.loading = loading;
	applyDomProps(el, { ...rest, children: undefined } as DomProps);
	if (blend) applyMediaBlendEffect(el, blend);
	toNodes(children);
	return el;
}
