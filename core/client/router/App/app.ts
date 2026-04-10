/// <reference types="vite/client" />
import type { UiNode } from "../../runtime/tag/props";
import { replaceChildrenWithDispose } from "../../runtime/logic/lifecycle";
import { FW_NAV } from "../nav-signal";
import { pushClientPath } from "./client-nav";
import { getRouteLoader, loadRouteModuleFresh } from "./route-loader";
import {
	emptyRoutePage,
	resetRouteUi,
	routeModuleLoading,
	routePhase,
	setRouteAsyncFallback,
	setRouteModuleLoading,
	setRoutePage,
	type ClientPage,
} from "./phase";
import { RouteProxy } from "./viewport";

export type Component<P = Record<string, unknown>> = (_props: P) => UiNode;
export type Shell = (Page: Component) => UiNode;

type AppRuntime = {
	render: (path: string, opts?: RenderOptions) => Promise<void>;
	setShell: (next: Shell) => void;
	dispose: () => void;
};
type RenderOptions = { hmr?: boolean };
type HmrUpdatePayload = {
	updates?: Array<{ type?: string; path?: string; acceptedPath?: string }>;
};

function interceptLinks(el: Element): () => void {
	const onClick = (e: Event) => {
		const a = (e.target as Element).closest("a[href]") as HTMLAnchorElement | null;
		if (!a || a.hasAttribute("data-external") || a.target) return;
		const u = new URL(a.href, location.origin);
		if (u.origin !== location.origin) return;
		e.preventDefault();
		pushClientPath(u.pathname + u.search + u.hash);
	};
	el.addEventListener("click", onClick);
	return () => el.removeEventListener("click", onClick);
}

function mount(node: UiNode, el: HTMLElement): void {
	if (node == null) replaceChildrenWithDispose(el);
	else replaceChildrenWithDispose(el, node as globalThis.Node);
}

type RouteModule = {
	default?: ClientPage;
	routeLoad?: () => void | Promise<void>;
	routeFallback?: ClientPage;
	routeLoading?: ClientPage;
};

export function App(shell: Shell): void {
	const g = globalThis as {
		__fwDispose?: () => void;
		__fwAppRuntime?: AppRuntime;
	};

	if (g.__fwAppRuntime) {
		g.__fwAppRuntime.setShell(shell);
		void g.__fwAppRuntime.render(location.pathname, { hmr: true });
		return;
	}

	const root = document.getElementById("root");
	if (!root) return;
	const rootEl = root;

	let shellRef = shell;
	let gen = 0;
	let rootMounted = false;

	async function render(path: string, opts: RenderOptions = {}): Promise<void> {
		const isHmr = opts.hmr === true;
		const my = ++gen;
		if (!isHmr) {
			routePhase("chunk");
			setRoutePage(emptyRoutePage);
			setRouteAsyncFallback(null);
			setRouteModuleLoading(null);
		}

		if (!rootMounted) {
			mount(shellRef(RouteProxy), rootEl);
			rootMounted = true;
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

	const onPopstate = () => void render(location.pathname);
	const onNav = (e: Event) => void render((e as CustomEvent<string>).detail);
	window.addEventListener("popstate", onPopstate);
	window.addEventListener(FW_NAV, onNav);
	const stopIntercept = interceptLinks(rootEl);
	void render(location.pathname);

	const dispose = () => {
		gen++;
		rootMounted = false;
		resetRouteUi();
		window.removeEventListener(FW_NAV, onNav);
		stopIntercept();
		window.removeEventListener("popstate", onPopstate);
	};
	const runtime: AppRuntime = {
		render,
		setShell(next) {
			shellRef = next;
			if (rootMounted) mount(shellRef(RouteProxy), rootEl);
		},
		dispose,
	};
	g.__fwAppRuntime = runtime;
	g.__fwDispose = dispose;

	type ViteHmr = {
		on(event: "vite:afterUpdate", fn: (payload: HmrUpdatePayload) => void): void;
		dispose(cb: () => void): void;
	};

	if (import.meta.hot) {
		(import.meta.hot as unknown as ViteHmr).on("vite:afterUpdate", (payload) => {
			const updates = payload?.updates ?? [];
			const hasJsUpdate = updates.some(
				(u: { type?: string }) => (u.type ?? "js-update") !== "css-update",
			);
			if (!hasJsUpdate) return;
			void render(location.pathname, { hmr: true });
		});

		(import.meta.hot as unknown as ViteHmr).dispose(() => {
			if (g.__fwAppRuntime === runtime) {
				runtime.dispose();
				delete g.__fwAppRuntime;
				delete g.__fwDispose;
			}
		});
	}
}
