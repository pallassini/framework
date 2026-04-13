import { watch } from "../../../state/effect";
import { toNodes } from "../../logic/children";
import { onNodeDispose, replaceChildrenWithDispose } from "../../logic/lifecycle";
import { applyDomProps } from "../../logic/dom-props";
import { readWhen } from "../../logic/read-when";
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

	const dispose = watch(() => {
		const allowed = readWhen(when);
		replaceChildrenWithDispose(anchor);
		if (allowed) {
			const nodes = toNodes(children);
			if (nodes.length) anchor.append(...nodes);
		} else if (fallback != null) {
			anchor.append(...toNodes(fallback));
		}
	});
	onNodeDispose(anchor, dispose);

	return anchor;
}
