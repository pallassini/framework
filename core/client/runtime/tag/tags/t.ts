import { applyDomProps } from "../../logic/dom-props";
import { toNodes } from "../../logic/children";
import { onNodeDispose } from "../../logic/lifecycle";
import { watchConditionalChildren } from "../../logic/conditional-children";
import type { DomProps, SharedProps, UiNode } from "../props";

export type TProps = SharedProps;

/**
 * Senza `s`: `<t>` con testo + nodi mescolati usa un wrapper **inline** (non `contents`), così in una `row` con `gap`
 * resta **un solo** flex item e il testo non si separa dal resto.
 */
function useInlineFlowContents(children: unknown, s: SharedProps["s"]): boolean {
	if (s != null && s !== false) return false;
	if (children == null || children === false) return false;
	if (typeof children === "string" || typeof children === "number") return false;
	if (Array.isArray(children)) {
		if (children.length === 0) return false;
		return children.some(
			(item) => item != null && item !== false && typeof item !== "string" && typeof item !== "number",
		);
	}
	return typeof children === "object";
}

export function t(props: TProps): UiNode {
	const el = document.createElement("span");
	const { children, show, fallback, s, ...rest } = props;
	const contents = useInlineFlowContents(children, s);
	if (!contents) el.style.minWidth = "0";
	applyDomProps(el, { ...rest, s, children: undefined } as DomProps);
	if (contents) {
		el.style.display = "inline";
		el.style.minWidth = "0";
	}

	if (show !== undefined) {
		const dispose = watchConditionalChildren(el, show, children, fallback);
		onNodeDispose(el, dispose);
	} else {
		const nodes = toNodes(children);
		if (nodes.length) el.append(...nodes);
	}
	return el;
}
