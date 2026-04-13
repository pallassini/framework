import type { ServerContext } from "../routes/context";
import type { ServerFn } from "../routes/rpc/types";

type CacheEntry = { value: unknown; expiresAt: number };

function inputKey(input: unknown): string {
	if (input == null) return "";
	try {
		return JSON.stringify(input);
	} catch {
		return String(input);
	}
}

/** Cache in-memory per input; imposta `ctx.cacheHit`. */
export function createCacheWrapper(ttlMs: number): (handler: ServerFn) => ServerFn {
	const store = new Map<string, CacheEntry>();

	return (handler: ServerFn): ServerFn => {
		return async (rawInput: unknown, ctx: ServerContext): Promise<unknown> => {
			const key = inputKey(rawInput);
			const now = Date.now();
			const cached = store.get(key);

			if (cached && cached.expiresAt > now) {
				ctx.cacheHit = true;
				return cached.value;
			}

			ctx.cacheHit = false;
			const value = await handler(rawInput, ctx);
			store.set(key, { value, expiresAt: now + ttlMs });
			return value;
		};
	};
}
