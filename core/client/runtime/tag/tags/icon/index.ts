import * as glyphs from "./icons";
import { applyDomProps } from "../../../logic/dom-props";
import type { DomProps, SharedProps, UiNode } from "../../props";
import "../../../../style/client-config-style";
import { CSS_LENGTH_RE, isCssVarToken } from "../../../../style/properties/utils/units";
import { resolveIconSizeFromScaleKey } from "./scale";

const customTemplates = new Map<string, SVGElement>();

export type BuiltinIconName = keyof typeof glyphs;

export type IconProps = SharedProps & {
	/** Chiavi di `icons.tsx` (autocomplete completo). */
	name: BuiltinIconName;
	size?: string | number;
	stroke?: string | number;
};

/** Registra un’icona extra (template clonato a ogni `<icon name={…} />`, come le built-in). */
export function registerIcon(name: string, template: SVGElement): void {
	customTemplates.set(name, template);
}

function resolveTemplate(name: string): SVGElement | undefined {
	if (Object.prototype.hasOwnProperty.call(glyphs, name)) {
		const g = glyphs[name as BuiltinIconName];
		return g instanceof SVGElement ? g : undefined;
	}
	return customTemplates.get(name);
}

function isExplicitCssSize(s: string): boolean {
	return CSS_LENGTH_RE.test(s) || isCssVarToken(s) || s.startsWith("clamp(");
}

/** `size={2}` / `size="3"` → chiavi in `clientConfig.style.icon`; numeri senza scala → `px`; stringhe esplicite (`24px`, `clamp(...)`) passano così. */
function resolveIconSizeProp(size: string | number | undefined): string {
	const defaultKey = "2";
	if (size == null) {
		return resolveIconSizeFromScaleKey(defaultKey) ?? "1.25rem";
	}
	if (typeof size === "number") {
		const from = resolveIconSizeFromScaleKey(String(size));
		if (from) return from;
		return `${size}px`;
	}
	if (isExplicitCssSize(size)) return size;
	const from = resolveIconSizeFromScaleKey(size);
	if (from) return from;
	return size;
}

export function icon(props: IconProps): UiNode {
	const { name, size, stroke, children: _c, ...rest } = props;
	const src = resolveTemplate(name);
	if (src == null) {
		return null;
	}
	const svg = src.cloneNode(true) as SVGElement;
	applyDomProps(svg, { ...rest, children: undefined } as DomProps);
	const s = resolveIconSizeProp(size);
	svg.setAttribute("width", s);
	svg.setAttribute("height", s);
	if (stroke != null) svg.setAttribute("stroke-width", String(stroke));
	return svg;
}

export * from "./icons";
