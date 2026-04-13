import type { ServerPath, ServerRoutes } from "./routes-gen";

function serverRpcBase(): string {
	if (import.meta.env.DEV) return "";
	const t = (import.meta.env.VITE_SERVER_RPC_ORIGIN as string | undefined)?.trim() ?? "";
	return t.replace(/\/$/, "");
}

async function rpcFetch(pathDots: string, input?: unknown): Promise<unknown> {
	const pathSeg = pathDots.replace(/\./g, "/");
	const base = serverRpcBase();
	const res = await fetch(`${base}/_server/${pathSeg}`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ input }),
	});
	const data = (await res.json()) as unknown;
	if (data && typeof data === "object" && "error" in data) {
		const e = (data as { error: { type?: string; message?: string } }).error;
		throw Object.assign(new Error(e.message ?? "Server error"), {
			type: e.type,
			status: res.status,
		});
	}
	return data;
}

function createLink(parts: string[]): unknown {
	const run = async (input?: unknown) => {
		const pathDots = parts.join(".");
		return rpcFetch(pathDots, input);
	};
	return new Proxy(run, {
		get(_target, seg: string | symbol) {
			if (typeof seg !== "string" || seg === "then") return undefined;
			return createLink([...parts, seg]);
		},
	});
}

type ApiForPath<P extends ServerPath> = [ServerRoutes[P]["in"]] extends [void]
	? () => Promise<ServerRoutes[P]["out"]>
	: [Extract<ServerRoutes[P]["in"], undefined>] extends [never]
		? (input: ServerRoutes[P]["in"]) => Promise<ServerRoutes[P]["out"]>
		: (input?: ServerRoutes[P]["in"]) => Promise<ServerRoutes[P]["out"]>;

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
	input: ServerRoutes[P]["in"],
): Promise<ServerRoutes[P]["out"]> {
	return rpcFetch(path, input) as Promise<ServerRoutes[P]["out"]>;
}
