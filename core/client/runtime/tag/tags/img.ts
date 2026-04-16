import { applyDomProps } from "../../logic/dom-props";
import { toNodes } from "../../logic/children";
import type { DomProps, SharedProps, UiNode } from "../props";
import { applyMediaBlendEffect, type MediaBlendLevel } from "./media/blend";

export type ImgProps = SharedProps & {
	src: string;
	alt?: string;
	decoding?: HTMLImageElement["decoding"];
	loading?: HTMLImageElement["loading"];
	/** Come Mappazzone: `mix-blend-mode: screen` + contrasto. */
	blend?: MediaBlendLevel;
};

export function img(props: ImgProps): UiNode {
	const el = document.createElement("img");
	const { src, alt, decoding, loading, children, blend, ...rest } = props;
	el.src = src;
	if (alt != null) el.alt = alt;
	if (decoding != null) el.decoding = decoding;
	if (loading != null) el.loading = loading;
	applyDomProps(el, { ...rest, children: undefined } as DomProps);
	if (blend) applyMediaBlendEffect(el, blend);
	toNodes(children);
	return el;
}
