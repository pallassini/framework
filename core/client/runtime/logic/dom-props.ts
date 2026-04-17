import { props } from "../tag/props";
import type { DomEl, DomProps, DomPropApplier } from "../tag/props";

const PROP = props as Record<string, DomPropApplier>;

const SKIP = new Set([
	"children",
	"when",
	"fallback",
	"each",
	"key",
	"pick",
	"bind",
]);

export function applyDomProps(el: DomEl, propsObj: DomProps): void {
	for (const [k, v] of Object.entries(propsObj)) {
		if (SKIP.has(k)) continue;
		const handler = PROP[k];
		if (handler) {
			handler(el, v);
			continue;
		}
			if (k === "className") {
			if (v != null && v !== false) el.setAttribute("class", String(v));
			continue;
		}
		if (k === "dangerouslySetInnerHTML") {
			if (
				v != null &&
				typeof v === "object" &&
				!Array.isArray(v) &&
				"__html" in (v as object)
			) {
				(el as HTMLElement).innerHTML = String((v as { __html: unknown }).__html);
			}
			continue;
		}
		if (k === "style" && v != null && typeof v === "object" && !Array.isArray(v)) {
			Object.assign((el as HTMLElement).style, v as Record<string, string | number>);
			continue;
		}
		if (v == null || v === false) continue;
		if (v === true) el.setAttribute(k, "");
		else if (typeof v !== "function") el.setAttribute(k, String(v));
	}
}

export type { UiNode, DomProps, SharedProps } from "../tag/props";
