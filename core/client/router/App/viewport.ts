import type { UiNode } from "../../runtime/tag/props";
import { watch } from "../../state";
import { toNodes } from "../../runtime/logic/children";
import { onNodeDispose, replaceChildrenWithDispose } from "../../runtime/logic/lifecycle";
import { stripRouteLoadingFromPageRoot } from "./strip-loading";
import {
	routeAsyncFallback,
	routeModuleLoading,
	routePage,
	routePhase,
	type ClientPage,
} from "./phase";

export function routerViewport(globalLoading: unknown, shellRouteLoading?: unknown): UiNode {
	const anchor = document.createElement("span");
	anchor.style.display = "contents";
	const ph = document.createElement("span");
	ph.style.display = "contents";
	const ch = document.createElement("span");
	ch.style.display = "contents";
	anchor.append(ph, ch);

	const dispose = watch(() => {
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
			const pageRoot = routePage()({});
			const stripped = stripRouteLoadingFromPageRoot(pageRoot);
			replaceChildrenWithDispose(ch, ...stripped);
		}
	});
	onNodeDispose(anchor, dispose);

	return anchor;
}

export const RouteProxy: ClientPage = function RouteProxy(props) {
	return routerViewport(props["loading"] ?? null, props["routeLoading"] as unknown);
};
