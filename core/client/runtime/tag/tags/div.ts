import { applyDomProps } from "../../logic/dom-props";
import { toNodes } from "../../logic/children";
import { onNodeDispose } from "../../logic/lifecycle";
import { watchConditionalChildren } from "../../logic/conditional-children";
import { show as applyShowToElement } from "../props/show";
import type { DomProps, SharedProps, UiNode } from "../props";

export type DivProps = SharedProps;

export function div(props: DivProps): UiNode {
	const el = document.createElement("div");
	const { children, show, fallback, ...rest } = props;
	applyDomProps(el, { ...rest, children: undefined } as DomProps);

	if (show !== undefined) {
		if (fallback != null) {
			const dispose = watchConditionalChildren(el, show, children, fallback);
			onNodeDispose(el, dispose);
		} else {
			const nodes = toNodes(children);
			if (nodes.length) el.append(...nodes);
			applyShowToElement(el, show);
		}
	} else {
		const nodes = toNodes(children);
		if (nodes.length) el.append(...nodes);
	}
	return el;
}
