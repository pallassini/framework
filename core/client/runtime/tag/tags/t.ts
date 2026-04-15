import { applyDomProps } from "../../logic/dom-props";
import { toNodes } from "../../logic/children";
import { onNodeDispose } from "../../logic/lifecycle";
import { watchConditionalChildren } from "../../logic/conditional-children";
import type { DomProps, SharedProps, UiNode } from "../props";

export type TProps = SharedProps;

export function t(props: TProps): UiNode {
	const el = document.createElement("span");
	const { children, show, fallback, ...rest } = props;
	applyDomProps(el, { ...rest, children: undefined } as DomProps);

	if (show !== undefined) {
		const dispose = watchConditionalChildren(el, show, children, fallback);
		onNodeDispose(el, dispose);
	} else {
		const nodes = toNodes(children);
		if (nodes.length) el.append(...nodes);
	}
	return el;
}
