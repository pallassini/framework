/**
 * createState(shape) → store annidato + callable; ogni ramo ha `.reset`.
 * createState(value) → Signal (Promise risolte automaticamente).
 */

import { signal, type Signal } from "./signal";
import { buildStore, isPlainObject, type StateMap } from "../utils/store";
import { withCallableStore } from "../utils/withCallableStore";

type CreateStateFn = {
	<T = unknown>(): Signal<T>;
	<T>(initial: Promise<T>): Signal<T | undefined>;
	<T>(initial: PromiseLike<T>): Signal<T | undefined>;
	<R>(initial: () => Promise<R>): Signal<R | undefined>;
	<U extends Record<string, unknown>>(shape: U): StateMap<U>;
	<V>(value: V): Signal<V>;
};

function createStateImpl(shapeOrValue?: unknown): StateMap<Record<string, unknown>> | Signal<unknown> {
	if (arguments.length === 0 || shapeOrValue === undefined) {
		return signal(undefined) as Signal<unknown>;
	}
	if (isPlainObject(shapeOrValue)) {
		return buildStore(shapeOrValue as Record<string, unknown>) as StateMap<Record<string, unknown>>;
	}
	return signal(shapeOrValue) as Signal<unknown>;
}

export function createState<T extends Record<string, unknown>>(shape: T): StateMap<T> & CreateStateFn;
export function createState<T>(value: T): Signal<T>;
export function createState<T>(
	shapeOrValue: T,
): (StateMap<T> & CreateStateFn) | Signal<T> {
	if (isPlainObject(shapeOrValue as object)) {
		const store = buildStore(shapeOrValue as Record<string, unknown>);
		const fn = ((other?: unknown) => createStateImpl(other)) as CreateStateFn;
		return withCallableStore(fn, store as Record<string, unknown>) as StateMap<T> & CreateStateFn;
	}
	return signal(shapeOrValue) as Signal<T>;
}
