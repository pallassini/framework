import { runWithPrefetchWatchCleanup } from "../../state/effect";
import { getRouteLoader, loadRouteModuleCached, toPathname, type RouteModule } from "../App/routes";

export type PrefetchMode = "module" | "all" | "no-assets" | "no-fetch";

export type PrefetchContext = {
	path: string;
	pathname: string;
	fetch: typeof globalThis.fetch;
	preloadAsset: (src: string) => void;
};

const fullPrefetchCache = new Map<string, Promise<void>>();
const warmedAssetCache = new Set<string>();

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

export function prefetch(path: string, mode: PrefetchMode = "all"): Promise<void> {
	const rawPath = String(path);
	const key = prefetchKey(rawPath, mode);
	const cached = fullPrefetchCache.get(key);
	if (cached) return cached;

	const loader = getRouteLoader(rawPath);
	if (!loader) return Promise.resolve();

	const pending = loadRouteModuleCached(loader)
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
