import { watch } from "../../../state/effect";
import { applyDomProps } from "../../logic/dom-props";
import { toNodes } from "../../logic/children";
import type { DomProps, SharedProps, UiNode } from "../props";
import { resolveFieldBinding, type FieldBinding } from "../../../form/form";

/**
 * Eventi su `<input>` per cui il primo argomento del handler è **il valore corrente** (stringa).
 * L’evento nativo resta passato come **secondo** argomento, se serve (es. `preventDefault`).
 */
const VALUE_EVENT_PROPS = ["input", "change", "blur", "focusout"] as const;

function wrapValueHandler(
	el: HTMLInputElement,
	handler: unknown,
): ((ev: Event) => void) | undefined {
	if (typeof handler !== "function") return undefined;
	const fn = handler as (value: string, ev: Event) => unknown;
	return (ev: Event): void => {
		fn(el.value, ev);
	};
}

/**
 * Handler su `<input>` per `input` / `change` / `blur` / `focusout`:
 * il primo argomento è **il valore corrente** dell’input; l’evento nativo resta come secondo argomento.
 */
type ValueHandler<E extends Event> = (value: string, ev: E) => void;

export type InputProps = Omit<SharedProps, "input" | "change" | "blur" | "focusout"> & {
	input?: ValueHandler<Event>;
	change?: ValueHandler<Event>;
	blur?: ValueHandler<FocusEvent>;
	focusout?: ValueHandler<FocusEvent>;
	bind?: FieldBinding;
	type?: HTMLInputElement["type"];
	/** Valore mostrato (imposta la proprietà `value` dell’elemento, non solo un attributo generico). */
	value?: string | number;
	/** Come HTML: valore iniziale se non usi `value` (utile per input non controllati). */
	defaultValue?: string | number;
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
	/** Dopo l’inserimento nel DOM mette il focus sull’input (anche se aggiunto dinamicamente). */
	autofocus?: boolean;
};

export function input(props: InputProps): UiNode {
	const el = document.createElement("input");
	const {
		bind,
		type,
		name,
		value,
		defaultValue,
		placeholder,
		autocomplete,
		disabled,
		readOnly,
		required,
		min,
		max,
		step,
		pattern,
		autofocus,
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

	const restWithValueHandlers = { ...rest } as Record<string, unknown>;
	/**
	 * Estrae l'handler utente `input` (lowercase) se presente: lo gestiamo a parte
	 * perché deve essere mergiato con `ctl.set` quando c'è `bind`, ed in ogni caso
	 * riceve come primo argomento il valore stringa (non l'Event).
	 */
	const userInputLower = restWithValueHandlers["input"] as
		| ((value: string, ev: Event) => void)
		| undefined;
	delete restWithValueHandlers["input"];

	for (const name of VALUE_EVENT_PROPS) {
		if (name === "input") continue; // gestito a parte sopra / sotto
		if (name in restWithValueHandlers) {
			restWithValueHandlers[name] = wrapValueHandler(el, restWithValueHandlers[name]);
		}
	}

	if (bind) {
		const ctl = resolveFieldBinding(bind);
		el.setAttribute("data-fw-form", bind.formId);
		el.setAttribute("data-fw-field", bind.field);
		const userOnInput = onInput as
			| ((value: string, ev: HTMLElementEventMap["input"]) => void)
			| undefined;
		const mergedOnInput = (ev: HTMLElementEventMap["input"]): void => {
			const v = (ev.target as HTMLInputElement).value;
			ctl.set(v);
			userOnInput?.(v, ev);
			userInputLower?.(v, ev);
		};
		applyDomProps(el, {
			...restWithValueHandlers,
			children: undefined,
			/**
			 * Chiave `input` (lowercase) perché il framework registra gli eventi in
			 * `CLIENT_EVENT_NAMES` come `"input"`, `"change"`, ecc. — non `onInput`.
			 */
			input: mergedOnInput,
		} as DomProps);
		watch(() => {
			const v = ctl.get();
			if (el.value !== v) el.value = v;
		});
	} else {
		/**
		 * Senza `bind`: accetto sia `onInput` (camelCase framework legacy) sia `input`
		 * (lowercase stile JSX nativo del framework). Se entrambi presenti chiamo
		 * prima camelCase, poi lowercase.
		 */
		const combined = userInputLower || onInput
			? (ev: HTMLElementEventMap["input"]): void => {
					const v = (ev.target as HTMLInputElement).value;
					(onInput as ((v: string, ev: Event) => void) | undefined)?.(v, ev);
					userInputLower?.(v, ev);
				}
			: undefined;
		applyDomProps(el, {
			...restWithValueHandlers,
			children: undefined,
			input: combined,
		} as DomProps);
		if (value !== undefined) el.value = String(value);
		else if (defaultValue !== undefined) el.defaultValue = String(defaultValue);
	}

	if (autofocus) {
		queueMicrotask(() => {
			if (!el.isConnected) return;
			el.focus();
		});
	}

	toNodes(children);
	return el;
}
