import { runWithPrefetchWatchCleanup } from "../../state";
import { routePatternFromFilePath } from "./path-map";

export type PrefetchMode = "module" | "all" | "no-assets" | "no-fetch";

export type PrefetchContext = {
	path: string;
	pathname: string;
	fetch: typeof globalThis.fetch;
	preloadAsset: (src: string) => void;
};

type RouteModule = {
	default: unknown;
	preload?: (ctx: PrefetchContext) => void | Promise<void>;
};
type RouteLoader = () => Promise<RouteModule>;
type RouteMap = Record<string, RouteLoader>;
type RouteKeyMap = Record<string, string>;

const ROUTE_GLOB = import.meta.glob<RouteModule>("../../../../client/routes/**/*.{ts,tsx}");

const ROUTES: RouteMap = Object.fromEntries(
	Object.entries(ROUTE_GLOB).flatMap(([key, loader]) => {
		const route = routePatternFromFilePath(key);
		return route != null ? [[route, loader]] : [];
	}),
);
const ROUTE_KEYS: RouteKeyMap = Object.fromEntries(
	Object.keys(ROUTE_GLOB).flatMap((key) => {
		const route = routePatternFromFilePath(key);
		return route != null ? [[route, key]] : [];
	}),
);

const prefetchCache = new WeakMap<RouteLoader, Promise<RouteModule>>();
const fullPrefetchCache = new Map<string, Promise<void>>();
const warmedAssetCache = new Set<string>();

function resolveRoute(pathname: string): RouteLoader | undefined {
	if (ROUTES[pathname]) return ROUTES[pathname];
	for (const [pattern, loader] of Object.entries(ROUTES)) {
		if (!pattern.includes(":")) continue;
		const re = new RegExp("^" + pattern.replace(/:[^/]+/g, "[^/]+") + "$");
		if (re.test(pathname)) return loader;
	}
	return ROUTES["*"];
}

function resolveRouteKey(pathname: string): string | undefined {
	if (ROUTE_KEYS[pathname]) return ROUTE_KEYS[pathname];
	for (const [pattern, key] of Object.entries(ROUTE_KEYS)) {
		if (!pattern.includes(":")) continue;
		const re = new RegExp("^" + pattern.replace(/:[^/]+/g, "[^/]+") + "$");
		if (re.test(pathname)) return key;
	}
	return ROUTE_KEYS["*"];
}

function toPathname(input: string): string {
	try {
		return new URL(input, location.origin).pathname;
	} catch {
		const noHash = input.split("#", 1)[0] ?? input;
		return noHash.split("?", 1)[0] ?? noHash;
	}
}

function normalizePathnameForRoutes(pathname: string): string {
	let p = pathname.replace(/\/index\.html$/i, "");
	if (p === "") p = "/";
	return p;
}

function getRouteLoader(inputPath: string): RouteLoader | undefined {
	return resolveRoute(normalizePathnameForRoutes(toPathname(inputPath)));
}

async function loadRouteModuleFresh(inputPath: string): Promise<RouteModule | null> {
	const pathname = normalizePathnameForRoutes(toPathname(inputPath));
	if (!import.meta.hot) {
		const loader = resolveRoute(pathname);
		return loader ? ((await loader()) as RouteModule) : null;
	}
	const key = resolveRouteKey(pathname);
	if (!key) return null;
	const specifier = `${key}?t=${Date.now()}`;
	return (await import(/* @vite-ignore */ specifier)) as RouteModule;
}

function preloadAsset(src: string): void {
	const u = new URL(src, location.origin).href;
	if (warmedAssetCache.has(u)) return;
	warmedAssetCache.add(u);
	const isVideo = /\.(mp4|webm|ogg|mov|m4v)(?:\?|#|$)/i.test(u);

	if (isVideo) {
		const video = document.createElement("video");
		video.preload = "metadata";
		video.muted = true;
		video.playsInline = true;
		video.src = u;
		video.load();
		return;
	}

	const img = new Image();
	img.decoding = "async";
	img.src = u;
}

function loadRouteModule(loader: RouteLoader): Promise<RouteModule> {
	const cached = prefetchCache.get(loader);
	if (cached) return cached;
	const pending = loader().catch((err) => {
		prefetchCache.delete(loader);
		throw err;
	});
	prefetchCache.set(loader, pending);
	return pending;
}

function noopPreloadAsset(_src: string): void {}

function collectMediaUrls(root: globalThis.Node): string[] {
	const out: string[] = [];
	const seen = new Set<string>();

	function add(raw: string | null | undefined): void {
		if (!raw) return;
		const abs = new URL(raw, location.origin).href;
		if (seen.has(abs)) return;
		seen.add(abs);
		out.push(abs);
	}

	function walk(n: globalThis.Node): void {
		if (n.nodeType === globalThis.Node.ELEMENT_NODE) {
			const el = n as Element;
			const tag = el.tagName;
			if (tag === "IMG") add((el as HTMLImageElement).src || el.getAttribute("src"));
			else if (tag === "VIDEO") {
				add((el as HTMLVideoElement).src || el.getAttribute("src"));
				add((el as HTMLVideoElement).poster || el.getAttribute("poster"));
			} else if (tag === "SOURCE") {
				add((el as HTMLSourceElement).src || el.getAttribute("src"));
			} else if (tag === "LINK" && el.getAttribute("rel") === "preload") {
				add(el.getAttribute("href"));
			}
		}
		for (const c of Array.from(n.childNodes)) walk(c);
	}

	if (root.nodeType === globalThis.Node.DOCUMENT_FRAGMENT_NODE) {
		for (const c of Array.from(root.childNodes)) walk(c);
	} else {
		walk(root);
	}
	return out;
}

function warmRouteDom(Page: (props: Record<string, unknown>) => unknown): void {
	if (typeof Page !== "function") return;

	const urls = runWithPrefetchWatchCleanup((): string[] => {
		let node: unknown;
		try {
			node = Page({});
		} catch {
			return [];
		}
		if (node == null || !(node instanceof globalThis.Node)) return [];
		return collectMediaUrls(node);
	});

	for (const src of urls) preloadAsset(src);
}

function runRoutePreload(
	rawPath: string,
	pathname: string,
	mod: RouteModule,
	assetFn: (src: string) => void,
): Promise<void> {
	const ctx: PrefetchContext = {
		path: rawPath,
		pathname,
		fetch: globalThis.fetch.bind(globalThis),
		preloadAsset: assetFn,
	};
	return Promise.resolve(mod.preload?.(ctx)).then(() => undefined);
}

function prefetchKey(rawPath: string, mode: PrefetchMode): string {
	return `${mode}|${toPathname(rawPath)}|${rawPath}`;
}

export function prefetch(
	path: string,
	mode: PrefetchMode = "all",
): Promise<void> {
	const rawPath = String(path);
	const key = prefetchKey(rawPath, mode);
	const cached = fullPrefetchCache.get(key);
	if (cached) return cached;

	const loader = getRouteLoader(rawPath);
	if (!loader) return Promise.resolve();

	const pending = loadRouteModule(loader)
		.then(async (mod) => {
			const pathname = toPathname(rawPath);
			const Page = mod.default;

			if (mode === "module") return;

			const wantPreload = mode !== "no-fetch";
			const wantDom = mode !== "no-assets";
			const assetFn = mode === "no-assets" ? noopPreloadAsset : preloadAsset;

			if (wantPreload) await runRoutePreload(rawPath, pathname, mod, assetFn);
			if (wantDom && typeof Page === "function") warmRouteDom(Page as (p: Record<string, unknown>) => unknown);
		})
		.catch((err) => {
			fullPrefetchCache.delete(key);
			throw err;
		});

	fullPrefetchCache.set(key, pending);
	return pending;
}

export { getRouteLoader, loadRouteModuleFresh };
