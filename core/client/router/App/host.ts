import { resetRouteUi } from "./signals";
import { RouteProxy } from "./viewport";
import { bind } from "./bind";
import { hot } from "./hot";
import { createRenderer, mount } from "./render";
import type { Shell } from "./types";

type AppRuntime = {
	render: (path: string, opts?: { hmr?: boolean }) => Promise<void>;
	setShell: (next: Shell) => void;
	dispose: () => void;
};

type FwGlobal = typeof globalThis & {
	__fwDispose?: () => void;
	__fwAppRuntime?: AppRuntime;
};

type AppBridge = {
	rootEl: HTMLElement;
	shellRef: { current: Shell };
	rootMounted: { current: boolean };
	render: (path: string, opts?: { hmr?: boolean }) => Promise<void>;
	invalidate: () => void;
	unbind: () => void;
};

function remountShell(rootEl: HTMLElement, shell: Shell, rootMounted: boolean): void {
	if (!rootMounted) return;
	mount(shell(RouteProxy), rootEl);
}

/** 1. Ritorna `true` se c’è già un runtime (HMR del modulo client). */
export function resumeAfterClientHmr(shell: Shell): boolean {
	const g = globalThis as FwGlobal;
	const prev = g.__fwAppRuntime;
	if (!prev) return false;
	prev.setShell(shell);
	void prev.render(location.pathname, { hmr: true });
	return true;
}

/** 2. Costruisce render, listener popstate/go/link, prima `render` sulla URL. */
export function setupRendererAndNav(shell: Shell, rootEl: HTMLElement): AppBridge {
	const shellRef = { current: shell };
	const rootMounted = { current: false };
	const { render, invalidate } = createRenderer(rootEl, shellRef, rootMounted);
	const unbind = bind(rootEl, render);
	void render(location.pathname);
	return { rootEl, shellRef, rootMounted, render, invalidate, unbind };
}

/** 3. Registra `__fwAppRuntime` / `__fwDispose` e hook Vite `hot`. */
export function primeRuntimeAndHot(bridge: AppBridge): void {
	const g = globalThis as FwGlobal;
	const { rootEl, shellRef, rootMounted, render, invalidate, unbind } = bridge;

	const dispose = () => {
		invalidate();
		resetRouteUi();
		unbind();
	};

	const runtime: AppRuntime = {
		render,
		setShell(next) {
			shellRef.current = next;
			remountShell(rootEl, shellRef.current, rootMounted.current);
		},
		dispose,
	};

	g.__fwAppRuntime = runtime;
	g.__fwDispose = dispose;

	hot(
		() => void render(location.pathname, { hmr: true }),
		() => {
			if (g.__fwAppRuntime === runtime) {
				runtime.dispose();
				delete g.__fwAppRuntime;
				delete g.__fwDispose;
			}
		},
	);
}
