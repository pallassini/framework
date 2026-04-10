import * as glyphs from "./icons";
import { applyDomProps } from "../../../logic/dom-props";
import type { DomProps, SharedProps, UiNode } from "../../props";

const customTemplates = new Map<string, SVGElement>();

export type BuiltinIconName = keyof typeof glyphs;

export type IconProps = SharedProps & {
	/** Chiavi di `icons.tsx` + nomi passati a `registerIcon`. */
	name: BuiltinIconName | (string & {});
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

export function icon(props: IconProps): UiNode {
	const { name, size, stroke, children: _c, ...rest } = props;
	const src = resolveTemplate(name);
	if (src == null) {
		console.warn(`[fw] icon non registrata: "${name}" (aggiungila in icons.tsx o registerIcon)`);
		return null;
	}
	const svg = src.cloneNode(true) as SVGElement;
	applyDomProps(svg, { ...rest, children: undefined } as DomProps);
	if (size != null) {
		const s = typeof size === "number" ? `${size}px` : String(size);
		svg.setAttribute("width", s);
		svg.setAttribute("height", s);
	}
	if (stroke != null) svg.setAttribute("stroke-width", String(stroke));
	return svg;
}

export * from "./icons";
