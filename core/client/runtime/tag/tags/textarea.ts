import { applyDomProps } from "../../logic/dom-props";
import { toNodes } from "../../logic/children";
import type { DomProps, SharedProps, UiNode } from "../props";

export type TextareaProps = SharedProps & {
	value?: string;
	/** Come `<input>`: valore iniziale se non usi `value` (modo non controllato). */
	defaultValue?: string;
};

export function textarea(props: TextareaProps): UiNode {
	const el = document.createElement("textarea");
	const { children, value, defaultValue, ...rest } = props;
	applyDomProps(el, { ...rest, children: undefined } as DomProps);
	if (value !== undefined) el.value = String(value);
	else if (defaultValue !== undefined) el.defaultValue = String(defaultValue);
	else {
		const nodes = toNodes(children);
		if (nodes.length) el.append(...nodes);
	}
	return el;
}
