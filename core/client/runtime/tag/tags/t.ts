import { applyDomProps } from "../../logic/dom-props";
import { toNodes } from "../../logic/children";
import type { DomProps, SharedProps, UiNode } from "../props";

export type TProps = SharedProps;

export function t(props: TProps): UiNode {
	const el = document.createElement("span");
	const { children, ...rest } = props;
	applyDomProps(el, { ...rest, children: undefined } as DomProps);
	const nodes = toNodes(children);
	if (nodes.length) el.append(...nodes);
	return el;
}
