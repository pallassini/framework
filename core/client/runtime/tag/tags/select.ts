import { watch } from "../../../state/effect";
import { applyDomProps } from "../../logic/dom-props";
import { toNodes } from "../../logic/children";
import { resolveFieldBinding, type FieldBinding } from "../../../form/form";
import type { DomProps, SharedProps, UiNode } from "../props";

type ValueHandler<E extends Event> = (value: string, ev: E) => void;

export type SelectProps = SharedProps & {
	/** Valore selezionato (deve corrispondere a `value` di un `<option>`). */
	value?: string;
	/** Collega il valore a un campo `Form` (stesso modello di `<input bind={...}>`). */
	bind?: FieldBinding;
	/** Dopo un cambio di selezione: primo argomento è il `value` stringa. */
	change?: ValueHandler<Event>;
	/** Uso raro: stessi dati di `change` (alcuni ascoltano `input` sul select). */
	input?: ValueHandler<Event>;
};

export function select(props: SelectProps): UiNode {
	const el = document.createElement("select");
	const { children, value, bind, change: userChange, input: userInput, ...rest } = props;

	if (bind) {
		const ctl = resolveFieldBinding(bind);
		el.setAttribute("data-fw-form", bind.formId);
		el.setAttribute("data-fw-field", bind.field);
		const merged = (ev: Event): void => {
			const v = (ev.target as HTMLSelectElement).value;
			ctl.set(v);
			userChange?.(v, ev);
			userInput?.(v, ev);
		};
		applyDomProps(el, {
			...(rest as object),
			children: undefined,
			change: merged,
		} as DomProps);
		const nodes = toNodes(children);
		if (nodes.length) el.append(...nodes);
		watch(() => {
			const v = ctl.get();
			if (el.value !== v) el.value = v;
		});
	} else {
		applyDomProps(el, { ...(rest as object), children: undefined } as DomProps);
		const nodes = toNodes(children);
		if (nodes.length) el.append(...nodes);
		if (value !== undefined) el.value = String(value);
		if (userChange != null || userInput != null) {
			el.addEventListener("change", (ev) => {
				const v = (ev.target as HTMLSelectElement).value;
				userChange?.(v, ev);
				userInput?.(v, ev);
			});
		}
	}

	return el;
}
