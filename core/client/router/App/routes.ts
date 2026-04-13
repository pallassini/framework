export type RouteModule = {
	default: unknown;
	preload?: (ctx: { path: string; pathname: string; fetch: typeof globalThis.fetch; preloadAsset: (src: string) => void }) => void | Promise<void>;
};

export type RouteLoader = () => Promise<RouteModule>;
type RouteMap = Record<string, RouteLoader>;
type RouteKeyMap = Record<string, string>;

const ROUTE_GLOB = import.meta.glob<RouteModule>("../../../../client/routes/**/*.{ts,tsx}");

if (import.meta.hot) {
	const routeDeps = Object.keys(ROUTE_GLOB);
	if (routeDeps.length > 0) {
		// Keep updates for route modules inside the HMR graph.
		import.meta.hot.accept(routeDeps, () => {});
	}
}

const ROUTES: RouteMap = Object.fromEntries(
	Object.entries(ROUTE_GLOB).flatMap(([key, loader]) => {
		const route = patternFromFile(key);
		return route != null ? [[route, loader]] : [];
	}),
);

const ROUTE_KEYS: RouteKeyMap = Object.fromEntries(
	Object.keys(ROUTE_GLOB).flatMap((key) => {
		const route = patternFromFile(key);
		return route != null ? [[route, key]] : [];
	}),
);

const moduleCache = new WeakMap<RouteLoader, Promise<RouteModule>>();

function patternFromFile(input: string): string | null {
	const norm = input.replace(/\\/g, "/");
	const fromGlob = norm.match(/\/routes\/(.+?)\.(?:tsx?|jsx?)$/);
	if (fromGlob) return segmentToPath(fromGlob[1]);
	const fromRel = norm.match(/^(.+?)\.(?:tsx?|jsx?)$/);
	if (fromRel) return segmentToPath(fromRel[1]);
	return null;
}

function segmentToPath(seg: string): string {
	if (seg === "index") return "/";
	if (seg.endsWith("/index")) return "/" + seg.slice(0, -"/index".length);
	if (seg.includes("[...")) return "*";
	return "/" + seg.replace(/\[([^\]]+)\]/g, ":$1");
}

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

export function toPathname(input: string): string {
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

export function getRouteLoader(inputPath: string): RouteLoader | undefined {
	return resolveRoute(normalizePathnameForRoutes(toPathname(inputPath)));
}

export async function loadRouteModuleFresh(inputPath: string): Promise<RouteModule | null> {
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

export function loadRouteModuleCached(loader: RouteLoader): Promise<RouteModule> {
	const cached = moduleCache.get(loader);
	if (cached) return cached;
	const pending = loader().catch((err) => {
		moduleCache.delete(loader);
		throw err;
	});
	moduleCache.set(loader, pending);
	return pending;
}
