/**
 * createState(shape) → store annidato + callable; ogni ramo ha `.reset`.
 * createState(value) → Signal (Promise risolte automaticamente).
 * createState(rpcGetRef[, getArgs]) → lista + `.create` / `.update` / `.remove` / `.refetch`.
 * `getArgs` = **stesso oggetto** di `rpcGetRef(getArgs)` (es. `{ where: { … } }`). Compat: `{ getInput: { … } }`.
 */

import { isRpcRunRef } from "../../../desktop/rpc-ref";
import { attachRpcListMethods, type RpcListBound } from "./attachRpcList";
import { takeRpcGetCallArgs, type RpcGetCallArgs } from "./rpc-get-args";
import { signal, type AutoSignal, type Signal } from "./signal";
import { buildStore, isPlainObject, type StateMap } from "../utils/store";
import { withCallableStore } from "../utils/withCallableStore";

export type { RpcGetCallArgs } from "./rpc-get-args";
/** @deprecated alias di {@link RpcGetCallArgs} */
export type RpcGetStateOptions = RpcGetCallArgs;

/** Firma larga per i metodi RPC generati (parametri `any` per `strictFunctionTypes`). */
export type RpcRunFn = (...args: any[]) => Promise<unknown>;

export type CreateStateFn = {
	<T = unknown>(): Signal<T>;
	<T>(initial: Promise<T>): AutoSignal<T | undefined>;
	<T>(initial: PromiseLike<T>): AutoSignal<T | undefined>;
	/** Prima di `() => Promise`: altrimenti i ref `*.get` RPC matchano come factory Promise. */
	<F extends RpcRunFn, _RefOverloadTag = never>(
		ref: F,
		opts?: RpcGetCallArgs,
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
	rpcGetOpts?: RpcGetCallArgs,
): StateMap<Record<string, unknown>> | Signal<unknown> | RpcListBound<unknown> {
	if (arguments.length === 0 || shapeOrValue === undefined) {
		return signal(undefined) as Signal<unknown>;
	}
	if (isRpcRunRef(shapeOrValue)) {
		const run = shapeOrValue as RpcRunFn;
		const getArgs = takeRpcGetCallArgs(rpcGetOpts);
		const initial = getArgs !== undefined ? run(getArgs) : run();
		const sig = signal(initial) as AutoSignal<unknown>;
		attachRpcListMethods(sig, run as (...args: unknown[]) => Promise<unknown>, getArgs);
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
	opts?: RpcGetCallArgs,
): RpcListBound<Awaited<ReturnType<F>>>;
export function createState<T extends Record<string, unknown>>(shape: T): CallableStateMap<T>;
export function createState<R>(compute: () => R): Signal<R> | AutoSignal<unknown>;
export function createState<T>(value: T): Signal<T>;
export function createState(
	shapeOrValue?: unknown,
	rpcGetOpts?: RpcGetCallArgs,
): CallableStateMap<Record<string, unknown>> | Signal<unknown> | RpcListBound<unknown> | AutoSignal<unknown> {
	if (arguments.length === 0 || shapeOrValue === undefined) {
		return signal(undefined) as Signal<unknown>;
	}
	if (isRpcRunRef(shapeOrValue)) {
		const run = shapeOrValue as RpcRunFn;
		const getArgs = takeRpcGetCallArgs(rpcGetOpts);
		const initial = getArgs !== undefined ? run(getArgs) : run();
		const sig = signal(initial) as AutoSignal<unknown>;
		attachRpcListMethods(sig, run as (...args: unknown[]) => Promise<unknown>, getArgs);
		return sig as RpcListBound<unknown>;
	}
	if (isPlainObject(shapeOrValue as object)) {
		const store = buildStore(shapeOrValue as Record<string, unknown>);
		const fn = ((other?: unknown, o?: RpcGetCallArgs) =>
			createStateImpl(other, o)) as CreateStateFn;
		return withCallableStore(
			fn as (...args: unknown[]) => unknown,
			store as Record<string, unknown>,
		) as CallableStateMap<Record<string, unknown>>;
	}
	return signal(shapeOrValue) as Signal<unknown> | AutoSignal<unknown>;
}
