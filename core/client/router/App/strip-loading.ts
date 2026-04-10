import type { UiNode } from "../../runtime/tag/props";

export const CLIENT_ROUTE_LOADING = "data-fw-route-loading";

export function stripRouteLoadingFromPageRoot(root: UiNode): globalThis.Node[] {
	if (root == null) return [];
	const g = root as globalThis.Node;

	if (g.nodeType === globalThis.Node.DOCUMENT_FRAGMENT_NODE) {
		const out: globalThis.Node[] = [];
		for (const c of Array.from(g.childNodes)) {
			if (
				c.nodeType === globalThis.Node.ELEMENT_NODE &&
				(c as Element).hasAttribute(CLIENT_ROUTE_LOADING)
			) {
				continue;
			}
			out.push(c);
		}
		return out;
	}

	if (
		g.nodeType === globalThis.Node.ELEMENT_NODE &&
		(g as Element).hasAttribute(CLIENT_ROUTE_LOADING)
	) {
		return [];
	}

	return [g];
}
