import type { ServerPath, ServerRoutes } from "./routes-gen";
import { getAuthHeaders } from "../auth/headers";
import { isRpcRunRef, markRpcRun, RPC_PATH_DOTS } from "../../desktop/rpc-ref";

export type RpcSettledResult<O> =
	| { readonly ok: true; readonly data: O }
	| { readonly ok: false; readonly error: unknown };

export type RpcCallbacks<O = unknown> = {
	onSuccess?: (data: O) => void;
	onError?: (error: unknown) => void;
	/** Solo per `error.type === "RATE_LIMIT"` (dopo l’errore RPC, prima di `onError`). */
	onRateLimit?: (error: unknown) => void;
	/** Dopo `onSuccess` / `onError` (sempre, successo o fallimento). */
	onSettled?: (result: RpcSettledResult<O>) => void;
};

function serverRpcBase(): string {
	if (import.meta.env.DEV) return "";
	const t = (import.meta.env.VITE_SERVER_RPC_ORIGIN as string | undefined)?.trim() ?? "";
	return t.replace(/\/$/, "");
}

function isRpcCallbacks(x: unknown): x is RpcCallbacks<unknown> {
	if (x === null || typeof x !== "object") return false;
	const o = x as Record<string, unknown>;
	const fnOrU = (v: unknown) => v === undefined || typeof v === "function";
	return (
		("onSuccess" in o && fnOrU(o.onSuccess)) ||
		("onError" in o && fnOrU(o.onError)) ||
		("onSettled" in o && fnOrU(o.onSettled)) ||
		("onRateLimit" in o && fnOrU(o.onRateLimit))
	);
}

/** `(input?, opts?)` oppure solo `(opts)` se il primo argomento è un blocco callbacks. */
export function extractRpcArgs(first: unknown, second: unknown): {
	input: unknown;
	opts?: RpcCallbacks<unknown>;
} {
	if (second !== undefined) {
		return {
			input: first,
			opts: isRpcCallbacks(second) ? second : undefined,
		};
	}
	if (first !== undefined && isRpcCallbacks(first)) {
		return { input: undefined, opts: first };
	}
	return { input: first };
}

function isPlainRecord(x: unknown): x is Record<string, unknown> {
	return typeof x === "object" && x !== null && !Array.isArray(x);
}

/** Merge argomenti `*.get`: shallow + `where` annidato. */
function mergeRpcGetFixed(
	fixed: Record<string, unknown>,
	input: unknown,
): unknown {
	if (input == null) {
		return Object.keys(fixed).length > 0 ? fixed : undefined;
	}
	if (!isPlainRecord(input)) return input;
	const merged: Record<string, unknown> = { ...fixed, ...input };
	const fW = fixed.where;
	const iW = input.where;
	if (isPlainRecord(fW) && isPlainRecord(iW)) {
		merged.where = { ...fW, ...iW };
	} else if (isPlainRecord(iW)) {
		merged.where = iW;
	} else if (isPlainRecord(fW)) {
		merged.where = fW;
	}
	return merged;
}

function bindRpcGet<F extends (...args: unknown[]) => Promise<unknown>>(
	ref: F,
	fixed: Record<string, unknown>,
): (first?: unknown, second?: unknown) => Promise<unknown> {
	if (!isRpcRunRef(ref)) {
		throw new TypeError("bindRpcGet: atteso un ref RPC (es. server…get)");
	}
	const pathDots = Reflect.get(ref as object, RPC_PATH_DOTS) as string | undefined;
	if (!pathDots?.endsWith(".get")) {
		throw new TypeError('bindRpcGet: atteso un metodo "*.get"');
	}
	const inner = ref as (first?: unknown, second?: unknown) => Promise<unknown>;
	const bound = markRpcRun(async (first?: unknown, second?: unknown) => {
		const { input, opts } = extractRpcArgs(first, second);
		const merged = mergeRpcGetFixed(fixed, input);
		return inner(merged, opts as never);
	});
	Object.defineProperty(bound, RPC_PATH_DOTS, {
		value: pathDots,
		enumerable: false,
		configurable: true,
	});
	return bound;
}

/** Invoca una route RPC per path puntato (`user.resource.update`). */
export async function rpcInvoke(
	pathDots: string,
	first?: unknown,
	second?: RpcCallbacks<unknown>,
): Promise<unknown> {
	const { input, opts } = extractRpcArgs(first, second);
	return rpcFetch(pathDots, input, opts);
}

async function rpcFetch<O>(pathDots: string, input?: unknown, opts?: RpcCallbacks<O>): Promise<O> {
	const pathSeg = pathDots.replace(/\./g, "/");
	const base = serverRpcBase();
	let res: Response;
	try {
		res = await fetch(`${base}/_server/${pathSeg}`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				...getAuthHeaders(),
			},
			body: JSON.stringify({ input }),
		});
	} catch (e) {
		opts?.onError?.(e);
		opts?.onSettled?.({ ok: false, error: e });
		throw e;
	}

	let data: unknown;
	try {
		data = await res.json();
	} catch (e) {
		opts?.onError?.(e);
		opts?.onSettled?.({ ok: false, error: e });
		throw e;
	}

	if (data && typeof data === "object" && "error" in data) {
		const e = (data as { error: { type?: string; message?: string } }).error;
		const err = Object.assign(new Error(e.message ?? "Server error"), {
			type: e.type,
			status: res.status,
		});
		if (e.type === "RATE_LIMIT") {
			opts?.onRateLimit?.(err);
		}
		opts?.onError?.(err);
		opts?.onSettled?.({ ok: false, error: err });
		throw err;
	}

	const out = data as O;
	opts?.onSuccess?.(out);
	opts?.onSettled?.({ ok: true, data: out });
	return out;
}

function createLink(parts: string[]): unknown {
	const pathDots = parts.join(".");
	const rawGet = async (first?: unknown, second?: unknown) => {
		const { input, opts } = extractRpcArgs(first, second);
		return rpcFetch(pathDots, input, opts);
	};
	const getterCore = markRpcRun(rawGet);
	Object.defineProperty(getterCore, RPC_PATH_DOTS, {
		value: pathDots,
		enumerable: false,
		configurable: true,
	});

	const isGet = parts[parts.length - 1] === "get";
	const run = isGet
		? markRpcRun(function smartGet(first?: unknown, second?: unknown): unknown {
				if (arguments.length === 0) {
					return (getterCore as () => Promise<unknown>)();
				}
				if (arguments.length === 1) {
					if (isRpcCallbacks(first)) {
						return (getterCore as (a?: unknown, b?: unknown) => Promise<unknown>)(undefined, first);
					}
					if (isPlainRecord(first)) {
						return bindRpcGet(
							getterCore as (first?: unknown, second?: unknown) => Promise<unknown>,
							first as Record<string, unknown>,
						);
					}
				}
				return (getterCore as (a?: unknown, b?: unknown) => Promise<unknown>)(first, second);
			})
		: getterCore;

	Object.defineProperty(run, RPC_PATH_DOTS, {
		value: pathDots,
		enumerable: false,
		configurable: true,
	});
	return new Proxy(run as object, {
		get(_target, seg: string | symbol, receiver) {
			if (seg === "then") return undefined;
			if (typeof seg === "string") {
				return createLink([...parts, seg]);
			}
			return Reflect.get(_target, seg, receiver);
		},
	});
}

type RpcCb<O> = RpcCallbacks<O>;

type RouteIn<P extends ServerPath> = ServerRoutes[P]["in"];
type RouteOut<P extends ServerPath> = ServerRoutes[P]["out"];

/**
 * Ref restituito da `get({ … })` (`bindRpcGet` a runtime): compatibile con `state(ref)` e stesso `Out` del GET.
 */
type RpcGetCurriedRef<Out> = (first?: unknown, second?: unknown) => Promise<Out>;

/** `*.get` con input obbligatorio (o oggetto senza `| undefined` sul tipo intero). */
interface ApiGetWithInput<In, Out> {
	(): Promise<Out>;
	(opts: RpcCb<Out>): Promise<Out>;
	(input: In): RpcGetCurriedRef<Out>;
	(input: In, opts: RpcCb<Out>): Promise<Out>;
}

/** `*.get` con `input?` nel tipo route. */
interface ApiGetWithOptionalInput<In, Out> {
	(): Promise<Out>;
	(opts: RpcCb<Out>): Promise<Out>;
	(input: In): RpcGetCurriedRef<Out>;
	(input?: In, opts?: RpcCb<Out>): Promise<Out>;
}

type ApiForPath<P extends ServerPath> = [RouteIn<P>] extends [void]
	? {
			(): Promise<RouteOut<P>>;
			(opts: RpcCb<RouteOut<P>>): Promise<RouteOut<P>>;
		}
	: P extends `${string}.get`
		? [undefined] extends [RouteIn<P>]
			? ApiGetWithOptionalInput<Exclude<RouteIn<P>, undefined>, RouteOut<P>>
			: ApiGetWithInput<RouteIn<P>, RouteOut<P>>
		: unknown extends RouteIn<P>
			? {
					(): Promise<RouteOut<P>>;
					(opts: RpcCb<RouteOut<P>>): Promise<RouteOut<P>>;
					(input: RouteIn<P>, opts?: RpcCb<RouteOut<P>>): Promise<RouteOut<P>>;
				}
			: [Extract<RouteIn<P>, undefined>] extends [never]
				? (input: RouteIn<P>, opts?: RpcCb<RouteOut<P>>) => Promise<RouteOut<P>>
				: (input?: RouteIn<P>, opts?: RpcCb<RouteOut<P>>) => Promise<RouteOut<P>>;

type PathToObject<P extends string, V> = P extends `${infer K}.${infer Rest}`
	? { readonly [key in K]: PathToObject<Rest, V> }
	: { readonly [key in P]: V };

type UnionToIntersection<U> = (U extends unknown ? (x: U) => void : never) extends (x: infer I) => void
	? I
	: never;

export type ServerApiMap = Prettify<
	UnionToIntersection<
		{
			[P in ServerPath]: PathToObject<P, ApiForPath<P>>;
		}[ServerPath]
	>
>;

type Prettify<T> = { [K in keyof T]: T[K] } & {};

export const server = new Proxy({} as Record<string, unknown>, {
	get(_o, seg: string | symbol) {
		if (typeof seg !== "string") return undefined;
		return createLink([seg]);
	},
}) as ServerApiMap;

export async function serverRpc<P extends ServerPath>(
	path: P,
	first?: ServerRoutes[P]["in"] | RpcCallbacks<ServerRoutes[P]["out"]>,
	second?: RpcCallbacks<ServerRoutes[P]["out"]>,
): Promise<ServerRoutes[P]["out"]> {
	const { input, opts } = extractRpcArgs(first, second);
	return rpcFetch(path, input, opts as RpcCallbacks<ServerRoutes[P]["out"]> | undefined) as Promise<
		ServerRoutes[P]["out"]
	>;
}
