import { toNodes } from "../../../logic/children";
import { applyDomProps, type DomProps, type UiNode } from "../../../logic/dom-props";

const SVG_NS = "http://www.w3.org/2000/svg";

/**
 * Tag HTML usati dentro `<foreignObject>` (o simili) negli export Figma / icone.
 * Tutto il resto va in namespace SVG (`createElementNS`), come il browser per i figli di `<svg>`,
 * senza whitelist di ogni `fe*` / `clipPath` / …
 */
const HTML_IN_ICON_MARKUP = new Set([
	"div",
	"span",
	"p",
	"br",
	"b",
	"i",
	"strong",
	"em",
	"u",
	"small",
	"sub",
	"sup",
	"img",
	"iframe",
	"canvas",
	"video",
	"audio",
	"source",
	"track",
	"input",
	"button",
	"form",
	"label",
	"select",
	"textarea",
	"option",
	"fieldset",
	"legend",
	"table",
	"thead",
	"tfoot",
	"tbody",
	"tr",
	"td",
	"th",
	"caption",
	"colgroup",
	"col",
	"ul",
	"ol",
	"li",
	"dl",
	"dt",
	"dd",
	"section",
	"article",
	"nav",
	"header",
	"footer",
	"main",
	"aside",
	"figure",
	"figcaption",
	"h1",
	"h2",
	"h3",
	"h4",
	"h5",
	"h6",
	"pre",
	"code",
	"blockquote",
	"script",
	"noscript",
]);

function createElementForIconTag(tagName: string): Element {
	const key = tagName.toLowerCase();
	if (HTML_IN_ICON_MARKUP.has(key)) {
		return document.createElement(tagName);
	}
	return document.createElementNS(SVG_NS, tagName);
}

/** Solo DOM/SVG — non importa `tag/index` (niente ciclo con `icons.tsx`). */
export function jsx(type: unknown, props: DomProps | null | undefined): UiNode {
	const p = (props ?? {}) as DomProps;
	if (typeof type === "string") {
		const el = createElementForIconTag(type);
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

type SvgOrHtml = DomProps & { children?: unknown };

export namespace JSX {
	export type Element = UiNode;
	/** Qualsiasi nome di tag (come nel DOM); i tipi non elencano ogni elemento SVG. */
	export interface IntrinsicElements {
		[elemName: string]: SvgOrHtml;
	}
}
