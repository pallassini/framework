import { applyDomProps } from "../../logic/dom-props";
import { toNodes } from "../../logic/children";
import type { DomProps, SharedProps, UiNode } from "../props";

export type DivProps = SharedProps;

export function div(props: DivProps): UiNode {
	const el = document.createElement("div");
	const { children, ...rest } = props;
	applyDomProps(el, { ...rest, children: undefined } as DomProps);
	const nodes = toNodes(children);
	if (nodes.length) el.append(...nodes);
	return el;
}
