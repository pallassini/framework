export interface ServerContext {
	/** Nome route RPC (`ping`, `api.foo`, …). */
	readonly routeName: string;
	readonly request: Request;
	readonly url: URL;
	readonly method: string;
	readonly headers: Headers;
	/** IP client (`x-forwarded-for` → fallback). */
	readonly ip: string;
	json<T = unknown>(): Promise<T>;
	text(): Promise<string>;
	/** Metadata runtime (middleware). */
	cacheHit?: boolean;
	rateLimitState?: {
		used: number;
		max: number;
		remaining: number;
		resetAt: number;
	};
	concurrencyState?: {
		active: number;
		max: number;
		queued: number;
		waited: boolean;
	};
	concurrencySameClient?: {
		active: number;
		max: number;
		queued: number;
		waited: boolean;
	};
}

export function createContext(req: Request, routeName: string): ServerContext {
	return {
		routeName,
		request: req,
		url: new URL(req.url),
		method: req.method.toUpperCase(),
		headers: req.headers,
		ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown",
		json: <T = unknown>() => req.json() as Promise<T>,
		text: () => req.text(),
	};
}
