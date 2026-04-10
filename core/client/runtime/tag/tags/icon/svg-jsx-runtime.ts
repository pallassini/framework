import { toNodes } from "../../../logic/children";
import { applyDomProps, type DomProps, type UiNode } from "../../../logic/dom-props";

const SVG_NS = "http://www.w3.org/2000/svg";

const SVG_TAGS = new Set([
	"svg",
	"path",
	"g",
	"circle",
	"ellipse",
	"line",
	"polyline",
	"polygon",
	"rect",
	"defs",
	"use",
	"mask",
	"clipPath",
	"linearGradient",
	"stop",
]);

/** Solo DOM/SVG — non importa `tag/index` (niente ciclo con `icons.tsx`). */
export function jsx(type: unknown, props: DomProps | null | undefined): UiNode {
	const p = (props ?? {}) as DomProps;
	if (typeof type === "string") {
		const el = SVG_TAGS.has(type)
			? document.createElementNS(SVG_NS, type)
			: document.createElement(type);
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
	export interface IntrinsicElements {
		svg: DomProps & { children?: unknown };
		path: DomProps & { d?: string; children?: unknown };
		g: DomProps & { children?: unknown };
		circle: DomProps & { children?: unknown };
		line: DomProps & { children?: unknown };
		rect: DomProps & { children?: unknown };
		polyline: DomProps & { children?: unknown };
		polygon: DomProps & { children?: unknown };
		defs: DomProps & { children?: unknown };
		use: DomProps & { children?: unknown };
	}
}
