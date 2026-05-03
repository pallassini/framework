import { RPC_PATH_DOTS } from "../../../desktop/rpc-ref";
import { rpcInvoke, type RpcCallbacks } from "../../server/server";
import type { AutoSignal } from "./signal";

/** Elemento lista se `T` è `readonly E[]` / `E[]` (eventuale `| undefined` sul valore signal). */
export type RpcListElement<T> = NonNullable<T> extends ReadonlyArray<infer E> ? E : never;

/** Argomento `create`: sottoinsieme della riga senza `id` (insert RPC). */
export type RpcListCreateInput<T> = [RpcListElement<T>] extends [never]
	? Record<string, unknown>
	: Partial<Omit<RpcListElement<T>, "id">>;

/** Valore PATCH: `Date` ammette anche stringa ISO come in JSON. */
export type RpcListWireField<V> = V extends Date
	? V | string
	: V extends Date | null
		? V | string
		: V extends Date | undefined
			? V | string
			: V extends Date | null | undefined
				? V | string
				: V;

/** Argomento `update`: campi della riga + `id`; chiavi sconosciute → errore su object literal. */
export type RpcListUpdateInput<T> = [RpcListElement<T>] extends [never]
	? Readonly<{ id: string } & Record<string, unknown>>
	: Partial<{
			[K in keyof RpcListElement<T>]: RpcListWireField<RpcListElement<T>[K]>;
		}> & {
			id: RpcListElement<T> extends { id: infer I } ? I : string;
		};

export type RpcListId<T> = [RpcListElement<T>] extends [never]
	? string
	: RpcListElement<T> extends { id: infer I }
		? I
		: string;

export type RpcListBound<T> = AutoSignal<T> & {
	create(input: RpcListCreateInput<T>, opts?: RpcCallbacks<unknown>): void;
	update(patch: RpcListUpdateInput<T>, opts?: RpcCallbacks<unknown>): void;
	remove(inp: RpcListId<T> | { id: RpcListId<T> }, opts?: RpcCallbacks<unknown>): void;
	refetch(): void;
};

type Row = Record<string, unknown> & { id?: string };

function readRows(sig: () => unknown): Row[] {
	const v = sig();
	return Array.isArray(v) ? (v as Row[]) : [];
}

/**
 * Su `state(rpcGetRef)` / `state(rpcGetRef, …)` con **gli stessi argomenti** di `rpcGetRef(…)`:
 * aggiunge `.create`, `.update`, `.remove`, `.refetch`
 * (solo se il ref è un `*.get`). Ottimistico + merge id da `create` / `row` da `update`.
 */
export function attachRpcListMethods(
	sig: AutoSignal<unknown>,
	runRef: (...args: unknown[]) => Promise<unknown>,
	getCallArgs?: Record<string, unknown>,
): void {
	const pathDots = Reflect.get(runRef as object, RPC_PATH_DOTS) as string | undefined;
	if (!pathDots?.endsWith(".get")) return;
	const base = pathDots.slice(0, -".get".length);

	const readList = () => readRows(sig as () => unknown);

	Object.defineProperty(sig, "create", {
		enumerable: false,
		configurable: true,
		value(input: Record<string, unknown>, opts?: RpcCallbacks<{ rows: Row[] }>) {
			const tempId = `__o:${crypto.randomUUID()}`;
			const prev = readList();
			const optimisticRow = { ...input, id: tempId } as Row;
			sig([...prev, optimisticRow] as never);
			void rpcInvoke(`${base}.create`, input, {
				...opts,
				onSuccess: (res) => {
					const row = (res as { rows?: Row[] })?.rows?.[0];
					if (row) {
						const cur = readList();
						sig(
							cur.map((r) => (String(r.id) === tempId ? { ...r, ...row } : r)) as never,
						);
					}
					opts?.onSuccess?.(res as { rows: Row[] });
				},
				onError: (e) => {
					sig(prev as never);
					opts?.onError?.(e);
				},
				onSettled: opts?.onSettled,
				onRateLimit: opts?.onRateLimit,
			} as RpcCallbacks<unknown>);
		},
	});

	Object.defineProperty(sig, "update", {
		enumerable: false,
		configurable: true,
		value(patch: Record<string, unknown> & { id: string }, opts?: RpcCallbacks<{ row: Row }>) {
			const { id } = patch;
			const prev = readList();
			const softArchive = "deletedAt" in patch && patch.deletedAt != null;
			const next = softArchive
				? prev.filter((r) => String(r.id) !== String(id))
				: prev.map((r) => (String(r.id) === String(id) ? { ...r, ...patch } : r));
			sig(next as never);
			void rpcInvoke(`${base}.update`, patch, {
				...opts,
				onSuccess: (res) => {
					const row = (res as { row?: Row })?.row;
					if (row) {
						const cur = readList();
						sig(
							cur.map((r) => (String(r.id) === String(id) ? { ...r, ...row } : r)) as never,
						);
					}
					opts?.onSuccess?.(res as { row: Row });
				},
				onError: (e) => {
					sig(prev as never);
					opts?.onError?.(e);
				},
				onSettled: opts?.onSettled,
				onRateLimit: opts?.onRateLimit,
			} as RpcCallbacks<unknown>);
		},
	});

	Object.defineProperty(sig, "remove", {
		enumerable: false,
		configurable: true,
		value(inp: string | { id: string }, opts?: RpcCallbacks<{ ok: true }>) {
			const id = typeof inp === "string" ? inp : inp.id;
			const prev = readList();
			sig(prev.filter((r) => String(r.id) !== String(id)) as never);
			void rpcInvoke(`${base}.remove`, { id }, {
				...opts,
				onError: (e) => {
					sig(prev as never);
					opts?.onError?.(e);
				},
				onSuccess: opts?.onSuccess,
				onSettled: opts?.onSettled,
				onRateLimit: opts?.onRateLimit,
			} as RpcCallbacks<unknown>);
		},
	});

	Object.defineProperty(sig, "refetch", {
		enumerable: false,
		configurable: true,
		value() {
			const p =
				getCallArgs !== undefined
					? Promise.resolve(runRef(getCallArgs))
					: Promise.resolve(runRef());
			void p.then((v) => sig(v as never));
		},
	});
}
