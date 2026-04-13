import type { DesktopPath, DesktopRoutes } from "./routes-gen";
import { markRpcRun } from "../rpc-ref";
import { getDesktopElectroview } from "./electroview";

export type DesktopRpcSettledResult<O> =
	| { readonly ok: true; readonly data: O }
	| { readonly ok: false; readonly error: unknown };

export type DesktopRpcCallbacks<O = unknown> = {
	onSuccess?: (data: O) => void;
	onError?: (error: unknown) => void;
	onSettled?: (result: DesktopRpcSettledResult<O>) => void;
};

function isRpcCallbacks(x: unknown): x is DesktopRpcCallbacks<unknown> {
	if (x === null || typeof x !== "object") return false;
	const o = x as Record<string, unknown>;
	const fnOrU = (v: unknown) => v === undefined || typeof v === "function";
	return (
		("onSuccess" in o && fnOrU(o.onSuccess)) ||
		("onError" in o && fnOrU(o.onError)) ||
		("onSettled" in o && fnOrU(o.onSettled))
	);
}

export function extractDesktopRpcArgs(first: unknown, second: unknown): {
	input: unknown;
	opts?: DesktopRpcCallbacks<unknown>;
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

type DesktopRequestFn = (params?: unknown) => Promise<unknown>;

function getDesktopHandler(pathDots: string): DesktopRequestFn {
	const ev = getDesktopElectroview();
	const client = ev.rpc as unknown as { request: Record<string, DesktopRequestFn | undefined> };
	const fn = client.request[pathDots];
	if (typeof fn !== "function") {
		throw new Error(`[desktop] route non registrata sul main: "${pathDots}"`);
	}
	return fn;
}

async function desktopInvoke<O>(pathDots: string, input?: unknown, opts?: DesktopRpcCallbacks<O>): Promise<O> {
	const fn = getDesktopHandler(pathDots);
	try {
		const raw = await fn(input);
		opts?.onSuccess?.(raw as O);
		opts?.onSettled?.({ ok: true, data: raw as O });
		return raw as O;
	} catch (e) {
		opts?.onError?.(e);
		opts?.onSettled?.({ ok: false, error: e });
		throw e;
	}
}

function createLink(parts: string[]): unknown {
	const run = markRpcRun(async (first?: unknown, second?: unknown) => {
		const pathDots = parts.join(".");
		const { input, opts } = extractDesktopRpcArgs(first, second);
		return desktopInvoke(pathDots, input, opts);
	});
	return new Proxy(run, {
		get(_target, seg: string | symbol) {
			if (typeof seg !== "string" || seg === "then") return undefined;
			return createLink([...parts, seg]);
		},
	});
}

type RpcCb<O> = DesktopRpcCallbacks<O>;

type ApiForPath<P extends DesktopPath> = [DesktopRoutes[P]["in"]] extends [void]
	? {
			(): Promise<DesktopRoutes[P]["out"]>;
			(opts: RpcCb<DesktopRoutes[P]["out"]>): Promise<DesktopRoutes[P]["out"]>;
		}
	: [Extract<DesktopRoutes[P]["in"], undefined>] extends [never]
		? (
				input: DesktopRoutes[P]["in"],
				opts?: RpcCb<DesktopRoutes[P]["out"]>,
			) => Promise<DesktopRoutes[P]["out"]>
		: (
				input?: DesktopRoutes[P]["in"],
				opts?: RpcCb<DesktopRoutes[P]["out"]>,
			) => Promise<DesktopRoutes[P]["out"]>;

type PathToObject<P extends string, V> = P extends `${infer K}.${infer Rest}`
	? { readonly [key in K]: PathToObject<Rest, V> }
	: { readonly [key in P]: V };

type UnionToIntersection<U> = (U extends unknown ? (x: U) => void : never) extends (x: infer I) => void
	? I
	: never;

export type DesktopApiMap = Prettify<
	UnionToIntersection<
		{
			[P in DesktopPath]: PathToObject<P, ApiForPath<P>>;
		}[DesktopPath]
	>
>;

type Prettify<T> = { [K in keyof T]: T[K] } & {};

export const desktop = new Proxy({} as Record<string, unknown>, {
	get(_o, seg: string | symbol) {
		if (typeof seg !== "string") return undefined;
		return createLink([seg]);
	},
}) as DesktopApiMap;
