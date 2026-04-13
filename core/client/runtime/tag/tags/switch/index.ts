import { watch } from "../../../../state/effect";
import { isSignal, type Signal } from "../../../../state/state";
import { toNodes } from "../../../logic/children";
import { onNodeDispose, replaceChildrenWithDispose } from "../../../logic/lifecycle";
import { applyDomProps } from "../../../logic/dom-props";
import { readWhen } from "../../../logic/read-when";
import { caseMeta } from "./case";
import type { DomProps, SharedProps, UiNode } from "../../props";

export type SwitchProps = SharedProps & {
	value?: unknown;
	fallback?: unknown;
};

function readSwitchValue(raw: unknown): unknown {
	if (isSignal(raw)) return (raw as Signal<unknown>)();
	if (typeof raw === "function" && !isSignal(raw)) return (raw as () => unknown)();
	return raw;
}

function matchesWithValue(switchVal: unknown, when: unknown): boolean {
	if (isSignal(when)) return Object.is(switchVal, (when as Signal<unknown>)());
	if (typeof when === "function" && !isSignal(when))
		return Boolean((when as (v: unknown) => unknown)(switchVal));
	return Object.is(switchVal, when);
}

function isCaseNode(n: globalThis.Node): boolean {
	return n instanceof HTMLElement && n.hasAttribute("data-fw-case");
}

function appendSwitchChild(root: HTMLElement, n: globalThis.Node): void {
	if (n instanceof DocumentFragment) {
		for (const c of n.childNodes) appendSwitchChild(root, c as globalThis.Node);
		return;
	}
	if (isCaseNode(n)) root.append(n);
	else if (n instanceof Text && !n.data.trim()) return;
	else {
		console.warn("[fw] <switch> accetta solo <case> come figli diretti; ignorato:", n);
	}
}

export function clientSwitch(props: SwitchProps): UiNode {
	const root = document.createElement("span");
	root.setAttribute("data-fw-switch", "");
	root.style.display = "contents";

	const hasValueMode = Object.prototype.hasOwnProperty.call(props, "value");
	const { fallback, children, value, ...rest } = props;
	applyDomProps(root, rest as DomProps);

	const fbAnchor = document.createElement("span");
	fbAnchor.setAttribute("data-fw-switch-fallback", "");
	fbAnchor.style.display = "contents";

	for (const n of toNodes(children)) appendSwitchChild(root, n);
	root.append(fbAnchor);

	const dispose = watch(() => {
		if (hasValueMode) readSwitchValue(value);

		const caseNodes = [...root.childNodes].filter(
			(n): n is HTMLElement =>
				n instanceof HTMLElement &&
				n.hasAttribute("data-fw-case") &&
				!n.hasAttribute("data-fw-switch-fallback"),
		);

		for (const c of caseNodes) readWhen(caseMeta(c).when);

		const switchVal = hasValueMode ? readSwitchValue(value) : undefined;

		let matchedIdx = -1;
		for (let i = 0; i < caseNodes.length; i++) {
			const { when } = caseMeta(caseNodes[i]);
			const ok = hasValueMode ? matchesWithValue(switchVal, when) : readWhen(when);
			if (ok) {
				matchedIdx = i;
				break;
			}
		}

		for (let i = 0; i < caseNodes.length; i++) {
			const el = caseNodes[i];
			replaceChildrenWithDispose(el);
			if (i === matchedIdx) {
				const { children: ch } = caseMeta(el);
				const nodes = toNodes(ch);
				if (nodes.length) el.append(...nodes);
			}
		}

		replaceChildrenWithDispose(fbAnchor);
		if (matchedIdx < 0 && fallback != null) fbAnchor.append(...toNodes(fallback));
	});
	onNodeDispose(root, dispose);

	return root;
}
