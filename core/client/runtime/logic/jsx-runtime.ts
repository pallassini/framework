import { toNodes } from "./children";
import { applyDomProps, type DomProps, type SharedProps, type UiNode } from "./dom-props";
import { ingestTagModule, resolveTagFn, type TagFn } from "./registry";
import type { FrameworkIntrinsicElements } from "../tag/jsx-intrinsic-elements";

import * as tagExports from "../tag";

ingestTagModule(tagExports as Record<string, unknown>);

export type { UiNode as Node };
export type Element = UiNode;

export function jsx(type: unknown, props: DomProps | null | undefined): UiNode {
	const p = (props ?? {}) as DomProps;
	if (typeof type === "function") return (type as TagFn)(p);

	if (typeof type === "string") {
		const tagFn = resolveTagFn(type);
		if (tagFn) {
			const r = tagFn(p);
			if (r != null) return r;
		}

		const el = document.createElement(type);
		applyDomProps(el, p);
		const nodes = toNodes(p.children);
		if (nodes.length) el.append(...nodes);
		return el;
	}

	return null;
}

export function jsxs(type: unknown, props: DomProps): UiNode {
	return jsx(type, props);
}

export function jsxDEV(
	type: unknown,
	props: DomProps,
	_key?: string | undefined,
	_isStaticChildren?: boolean,
	_source?: { fileName: string; lineNumber: number },
	_self?: unknown,
): UiNode {
	void _key;
	void _isStaticChildren;
	void _source;
	void _self;
	return jsx(type, props);
}

export function Fragment({ children }: { children?: unknown }): UiNode {
	const frag = document.createDocumentFragment();
	const nodes = toNodes(children);
	if (nodes.length) frag.append(...nodes);
	return frag;
}

export namespace JSX {
	export type Element = UiNode;
	export interface IntrinsicElements extends FrameworkIntrinsicElements {
		[name: string]: SharedProps;
	}
}
