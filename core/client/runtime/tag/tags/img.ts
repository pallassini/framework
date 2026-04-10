import { applyDomProps } from "../../logic/dom-props";
import { toNodes } from "../../logic/children";
import type { DomProps, SharedProps, UiNode } from "../props";

export type ImgProps = SharedProps & {
	src: string;
	alt?: string;
	decoding?: HTMLImageElement["decoding"];
	loading?: HTMLImageElement["loading"];
};

export function img(props: ImgProps): UiNode {
	const el = document.createElement("img");
	const { src, alt, decoding, loading, children, ...rest } = props;
	el.src = src;
	if (alt != null) el.alt = alt;
	if (decoding != null) el.decoding = decoding;
	if (loading != null) el.loading = loading;
	applyDomProps(el, { ...rest, children: undefined } as DomProps);
	const ch = toNodes(children);
	if (ch.length) console.warn("[fw] <img> ignora i children.");
	return el;
}
