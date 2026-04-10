import type { UiNode } from "../../runtime/tag/props";
import { replaceChildrenWithDispose } from "../../runtime/logic/lifecycle";
import { getRouteLoader, loadRouteModuleFresh } from "./loader";
import {
	emptyRoutePage,
	routeModuleLoading,
	routePhase,
	setRouteAsyncFallback,
	setRouteModuleLoading,
	setRoutePage,
	type ClientPage,
} from "./signals";
import type { Component, Shell } from "./types";
import { RouteProxy } from "./viewport";

export type RenderOptions = { hmr?: boolean };

type RouteModule = {
	default?: ClientPage;
	routeLoad?: () => void | Promise<void>;
	routeFallback?: ClientPage;
	routeLoading?: ClientPage;
};

export function mount(node: UiNode, el: HTMLElement): void {
	if (node == null) replaceChildrenWithDispose(el);
	else replaceChildrenWithDispose(el, node as globalThis.Node);
}

/** Carica il modulo route, aggiorna i signal, gestisce `routeLoad` e le UI di loading. */
export function createRenderer(
	rootEl: HTMLElement,
	shellRef: { current: Shell },
	rootMounted: { current: boolean },
) {
	let gen = 0;

	async function render(path: string, opts: RenderOptions = {}): Promise<void> {
		const isHmr = opts.hmr === true;
		const my = ++gen;
		if (!isHmr) {
			routePhase("chunk");
			setRoutePage(emptyRoutePage);
			setRouteAsyncFallback(null);
			setRouteModuleLoading(null);
		}

		if (!rootMounted.current) {
			mount(shellRef.current(RouteProxy), rootEl);
			rootMounted.current = true;
		}

		const loader = getRouteLoader(path);
		const mod = (isHmr
			? await loadRouteModuleFresh(path)
			: loader
				? await loader()
				: null) as RouteModule | null;
		if (my !== gen) return;

		const Page = (mod?.default ?? (() => null)) as Component;
		const routeLoad = mod?.routeLoad;
		const rf = mod?.routeFallback;
		const rl = mod?.routeLoading;

		setRoutePage(Page as ClientPage);
		setRouteAsyncFallback(null);
		setRouteModuleLoading(null);

		if (isHmr) {
			routePhase("idle");
			const x = window.scrollX;
			const y = window.scrollY;
			queueMicrotask(() => window.scrollTo(x, y));
			return;
		}

		setRouteModuleLoading(typeof rl === "function" ? rl : null);

		if (typeof routeLoad === "function") {
			setRouteAsyncFallback(rf ?? null);
			routePhase("route");
			await routeLoad();
			if (my !== gen) return;
			setRouteAsyncFallback(null);
		}

		if (routeModuleLoading() != null) {
			routePhase("route");
			queueMicrotask(() => {
				if (my !== gen) return;
				setRouteModuleLoading(null);
				routePhase("idle");
			});
		} else {
			routePhase("idle");
		}
	}

	function invalidate(): void {
		gen++;
		rootMounted.current = false;
	}

	return { render, invalidate };
}
