/**
 * createState(shape) → store annidato + callable; ogni ramo ha `.reset`.
 * createState(value) → Signal (Promise risolte automaticamente).
 * createState(rpcGetRef[, { getInput }]) → lista + `.create` / `.update` / `.remove` / `.refetch`.
 */

import { isRpcRunRef } from "../../../desktop/rpc-ref";
import { attachRpcListMethods, type RpcListBound } from "./attachRpcList";
import { signal, type AutoSignal, type Signal } from "./signal";
import { buildStore, isPlainObject, type StateMap } from "../utils/store";
import { withCallableStore } from "../utils/withCallableStore";

export type RpcGetStateOptions = { getInput?: Record<string, unknown> };

/** Firma larga per i metodi RPC generati (parametri `any` per `strictFunctionTypes`). */
export type RpcRunFn = (...args: any[]) => Promise<unknown>;

export type CreateStateFn = {
	<T = unknown>(): Signal<T>;
	<T>(initial: Promise<T>): AutoSignal<T | undefined>;
	<T>(initial: PromiseLike<T>): AutoSignal<T | undefined>;
	/** Prima di `() => Promise`: altrimenti i ref `*.get` RPC matchano come factory Promise. */
	<F extends RpcRunFn, _RefOverloadTag = never>(
		ref: F,
		opts?: RpcGetStateOptions,
	): RpcListBound<Awaited<ReturnType<F>>>;
	<R>(initial: () => Promise<R>): AutoSignal<R | undefined>;
	<U extends Record<string, unknown>>(shape: U): StateMap<U>;
	/** Funzione sincrona → segnale derivato (legge altri signal in `compute`). */
	<R>(compute: () => R): Signal<R>;
	<V>(value: V): Signal<V>;
};

export type CallableStateMap<T extends Record<string, unknown>> = StateMap<T> & CreateStateFn;

function createStateImpl(
	shapeOrValue?: unknown,
	rpcGetOpts?: RpcGetStateOptions,
): StateMap<Record<string, unknown>> | Signal<unknown> | RpcListBound<unknown> {
	if (arguments.length === 0 || shapeOrValue === undefined) {
		return signal(undefined) as Signal<unknown>;
	}
	if (isRpcRunRef(shapeOrValue)) {
		const run = shapeOrValue as RpcRunFn;
		const initial =
			rpcGetOpts?.getInput !== undefined ? run(rpcGetOpts.getInput) : run();
		const sig = signal(initial) as AutoSignal<unknown>;
		attachRpcListMethods(sig, run as (...args: unknown[]) => Promise<unknown>, rpcGetOpts?.getInput);
		return sig as RpcListBound<unknown>;
	}
	if (isPlainObject(shapeOrValue)) {
		return buildStore(shapeOrValue as Record<string, unknown>) as StateMap<Record<string, unknown>>;
	}
	return signal(shapeOrValue) as Signal<unknown>;
}

export function createState(): Signal<undefined>;
export function createState<F extends RpcRunFn>(
	ref: F,
	opts?: RpcGetStateOptions,
): RpcListBound<Awaited<ReturnType<F>>>;
export function createState<T extends Record<string, unknown>>(shape: T): CallableStateMap<T>;
export function createState<R>(compute: () => R): Signal<R> | AutoSignal<unknown>;
export function createState<T>(value: T): Signal<T>;
export function createState(
	shapeOrValue?: unknown,
	rpcGetOpts?: RpcGetStateOptions,
): CallableStateMap<Record<string, unknown>> | Signal<unknown> | RpcListBound<unknown> | AutoSignal<unknown> {
	if (arguments.length === 0 || shapeOrValue === undefined) {
		return signal(undefined) as Signal<unknown>;
	}
	if (isRpcRunRef(shapeOrValue)) {
		const run = shapeOrValue as RpcRunFn;
		const initial =
			rpcGetOpts?.getInput !== undefined ? run(rpcGetOpts.getInput) : run();
		const sig = signal(initial) as AutoSignal<unknown>;
		attachRpcListMethods(sig, run as (...args: unknown[]) => Promise<unknown>, rpcGetOpts?.getInput);
		return sig as RpcListBound<unknown>;
	}
	if (isPlainObject(shapeOrValue as object)) {
		const store = buildStore(shapeOrValue as Record<string, unknown>);
		const fn = ((other?: unknown, o?: RpcGetStateOptions) =>
			createStateImpl(other, o)) as CreateStateFn;
		return withCallableStore(
			fn as (...args: unknown[]) => unknown,
			store as Record<string, unknown>,
		) as CallableStateMap<Record<string, unknown>>;
	}
	return signal(shapeOrValue) as Signal<unknown> | AutoSignal<unknown>;
}
