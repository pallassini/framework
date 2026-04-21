import { applyDomProps } from "../../logic/dom-props";
import { toNodes } from "../../logic/children";
import type { DomProps, SharedProps, UiNode } from "../props";

export type SelectProps = SharedProps & {
	/** Valore selezionato (deve corrispondere a `value` di un `<option>`). */
	value?: string;
};

export function select(props: SelectProps): UiNode {
	const el = document.createElement("select");
	const { children, value, ...rest } = props;
	applyDomProps(el, { ...rest, children: undefined } as DomProps);
	const nodes = toNodes(children);
	if (nodes.length) el.append(...nodes);
	if (value !== undefined) el.value = String(value);
	return el;
}
