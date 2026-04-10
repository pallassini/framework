import { isSignal, watch, type Signal } from "../../state";
import { onNodeDispose } from "./lifecycle";

export type DOMChildNode = HTMLElement | SVGElement | Text | DocumentFragment;

export function toNodes(child: unknown): DOMChildNode[] {
	if (child == null || child === false) return [];
	if (Array.isArray(child)) {
		const out: DOMChildNode[] = [];
		for (let i = 0; i < child.length; i++) out.push(...toNodes(child[i]));
		return out;
	}
	if (isSignal(child)) {
		const frag = document.createDocumentFragment();
		const text = document.createTextNode("");
		frag.append(text);
		const sig = child as Signal<unknown>;
		const dispose = watch(() => {
			const v = sig();
			text.data = v == null || v === false ? "" : String(v);
		});
		onNodeDispose(text, dispose);
		return [frag];
	}
	if (
		child instanceof HTMLElement ||
		child instanceof SVGElement ||
		child instanceof Text ||
		child instanceof DocumentFragment
	)
		return [child];
	return [document.createTextNode(String(child))];
}
