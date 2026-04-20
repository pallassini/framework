import type { ServerPath, ServerRoutes } from "./routes-gen";
import { getAuthHeaders } from "../auth/headers";
import { markRpcRun } from "../../desktop/rpc-ref";

export type RpcSettledResult<O> =
	| { readonly ok: true; readonly data: O }
	| { readonly ok: false; readonly error: unknown };

export type RpcCallbacks<O = unknown> = {
	onSuccess?: (data: O) => void;
	onError?: (error: unknown) => void;
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
		("onSettled" in o && fnOrU(o.onSettled))
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
	const run = markRpcRun(async (first?: unknown, second?: unknown) => {
		const pathDots = parts.join(".");
		const { input, opts } = extractRpcArgs(first, second);
		return rpcFetch(pathDots, input, opts);
	});
	return new Proxy(run, {
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

type ApiForPath<P extends ServerPath> = [ServerRoutes[P]["in"]] extends [void]
	? {
			(): Promise<ServerRoutes[P]["out"]>;
			(opts: RpcCb<ServerRoutes[P]["out"]>): Promise<ServerRoutes[P]["out"]>;
		}
	: [Extract<ServerRoutes[P]["in"], undefined>] extends [never]
		? (
				input: ServerRoutes[P]["in"],
				opts?: RpcCb<ServerRoutes[P]["out"]>,
			) => Promise<ServerRoutes[P]["out"]>
		: (
				input?: ServerRoutes[P]["in"],
				opts?: RpcCb<ServerRoutes[P]["out"]>,
			) => Promise<ServerRoutes[P]["out"]>;

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
