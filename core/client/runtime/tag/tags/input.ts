import { watch } from "../../../state/effect";
import { applyDomProps } from "../../logic/dom-props";
import { toNodes } from "../../logic/children";
import type { DomProps, SharedProps, UiNode } from "../props";
import { resolveFieldBinding, type FieldBinding } from "../../../form/form";

export type InputProps = SharedProps & {
	bind?: FieldBinding;
	type?: HTMLInputElement["type"];
	name?: string;
	placeholder?: string;
	autocomplete?: string;
	disabled?: boolean;
	readOnly?: boolean;
	required?: boolean;
	min?: string | number;
	max?: string | number;
	step?: string | number;
	pattern?: string;
};

export function input(props: InputProps): UiNode {
	const el = document.createElement("input");
	const {
		bind,
		type,
		name,
		placeholder,
		autocomplete,
		disabled,
		readOnly,
		required,
		min,
		max,
		step,
		pattern,
		children,
		onInput,
		...rest
	} = props;

	if (type != null) el.type = type;
	if (name != null) el.name = name;
	if (placeholder != null) el.placeholder = placeholder;
	if (autocomplete != null) el.setAttribute("autocomplete", autocomplete);
	if (disabled != null) el.disabled = disabled;
	if (readOnly != null) el.readOnly = readOnly;
	if (required != null) el.required = required;
	if (min != null) el.min = String(min);
	if (max != null) el.max = String(max);
	if (step != null) el.step = String(step);
	if (pattern != null) el.pattern = pattern;

	if (bind) {
		const ctl = resolveFieldBinding(bind);
		const userOnInput = onInput as ((ev: HTMLElementEventMap["input"]) => void) | undefined;
		const mergedOnInput = (ev: HTMLElementEventMap["input"]): void => {
			ctl.set((ev.target as HTMLInputElement).value);
			userOnInput?.(ev);
		};
		applyDomProps(el, { ...rest, children: undefined, onInput: mergedOnInput } as DomProps);
		watch(() => {
			const v = ctl.get();
			if (el.value !== v) el.value = v;
		});
	} else {
		applyDomProps(el, { ...rest, children: undefined, onInput } as DomProps);
	}

	const nodes = toNodes(children);
	if (nodes.length) console.warn("[fw] <input> ignora i children.");
	return el;
}
