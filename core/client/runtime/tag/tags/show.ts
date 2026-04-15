import { onNodeDispose } from "../../logic/lifecycle";
import { applyDomProps } from "../../logic/dom-props";
import { watchConditionalChildren } from "../../logic/conditional-children";
import type { DomProps, SharedProps, UiNode } from "../props";

export type ShowProps = SharedProps & {
	when: unknown;
	fallback?: unknown;
};

export function show(props: ShowProps): UiNode {
	const anchor = document.createElement("span");
	anchor.setAttribute("data-fw-show", "");
	anchor.style.display = "contents";

	const { when, fallback, children, ...rest } = props;
	applyDomProps(anchor, rest as DomProps);

	const dispose = watchConditionalChildren(anchor, when, children, fallback);
	onNodeDispose(anchor, dispose);

	return anchor;
}
