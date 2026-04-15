import type { UiNode } from "../../runtime/tag/props";
import { watch } from "../../state/effect";
import { beginRouteLocalFrame } from "../../state/local";
import { styleViewport } from "../../style/viewport";
import { toNodes } from "../../runtime/logic/children";
import { onNodeDispose, replaceChildrenWithDispose } from "../../runtime/logic/lifecycle";
import {
	routeAsyncFallback,
	routeModuleLoading,
	routePage,
	routePhase,
	type ClientPage,
} from "./signals";

const LOADING = "data-fw-route-loading";

function stripLoadingRoot(root: UiNode): globalThis.Node[] {
	if (root == null) return [];
	const g = root as globalThis.Node;

	if (g.nodeType === globalThis.Node.DOCUMENT_FRAGMENT_NODE) {
		const out: globalThis.Node[] = [];
		for (const c of Array.from(g.childNodes)) {
			if (
				c.nodeType === globalThis.Node.ELEMENT_NODE &&
				(c as Element).hasAttribute(LOADING)
			) {
				continue;
			}
			out.push(c);
		}
		return out;
	}

	if (g.nodeType === globalThis.Node.ELEMENT_NODE && (g as Element).hasAttribute(LOADING)) {
		return [];
	}

	return [g];
}

export function viewport(globalLoading: unknown, shellRouteLoading?: unknown): UiNode {
	const anchor = document.createElement("span");
	anchor.style.display = "contents";
	const ph = document.createElement("span");
	ph.style.display = "contents";
	const ch = document.createElement("span");
	ch.style.display = "contents";
	anchor.append(ph, ch);

	const dispose = watch(() => {
		void styleViewport();
		const phase = routePhase();
		const asyncFb = routeAsyncFallback();
		const modLoading = routeModuleLoading();

		if (phase === "chunk") {
			ph.style.display = "contents";
			ch.style.display = "none";
			replaceChildrenWithDispose(ph, ...toNodes(globalLoading));
			replaceChildrenWithDispose(ch);
		} else if (phase === "route") {
			ph.style.display = "contents";
			ch.style.display = "none";
			if (asyncFb) replaceChildrenWithDispose(ph, ...toNodes(asyncFb({})));
			else if (modLoading) replaceChildrenWithDispose(ph, ...toNodes(modLoading({})));
			else replaceChildrenWithDispose(ph, ...toNodes(shellRouteLoading ?? globalLoading));
			replaceChildrenWithDispose(ch);
		} else {
			ph.style.display = "none";
			ch.style.display = "contents";
			replaceChildrenWithDispose(ph);
			beginRouteLocalFrame();
			const pageRoot = routePage()({});
			replaceChildrenWithDispose(ch, ...stripLoadingRoot(pageRoot));
		}
	});
	onNodeDispose(anchor, dispose);

	return anchor;
}

export const RouteProxy: ClientPage = function RouteProxy(props) {
	return viewport(props["loading"] ?? null, props["routeLoading"] as unknown);
};
