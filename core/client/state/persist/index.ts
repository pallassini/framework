import { isRpcRunRef } from "../../../desktop/rpc-ref";
import { type Signal } from "../state/signal";
import { buildStore, isPlainObject, type StateMap } from "../utils/store";
import { withCallableStore } from "../utils/withCallableStore";
import { bindManagedStore } from "../utils/globalStoreMeta";
import { bindPersistIdb } from "./storage";
import { createState } from "../state/createState";

export type PersistStateOptions = { storageKey?: string };

let counter = 0;

type CreatePersistStateFn = {
	<U extends Record<string, unknown>>(shape: U, options?: PersistStateOptions): StateMap<U>;
	<V>(value: V): Signal<V>;
};

function createPersistStateImpl(shapeOrValue: unknown, opts?: PersistStateOptions): StateMap<Record<string, unknown>> | Signal<unknown> {
	if (arguments.length === 0 || shapeOrValue === undefined) {
		return createState() as Signal<unknown>;
	}
	if (isRpcRunRef(shapeOrValue)) {
		return createState(shapeOrValue) as Signal<unknown>;
	}
	if (isPlainObject(shapeOrValue)) {
		const s = buildStore(shapeOrValue as Record<string, unknown>);
		bindPersistIdb(s as Record<string, unknown>, opts?.storageKey ?? `local.${++counter}`);
		return s as StateMap<Record<string, unknown>>;
	}
	return createState(shapeOrValue) as Signal<unknown>;
}

export function createPersistState<T extends Record<string, unknown>>(
	shape: T,
	options?: PersistStateOptions,
): StateMap<T> & CreatePersistStateFn;
export function createPersistState<T>(value: T): Signal<T>;
export function createPersistState(
	shapeOrValue?: unknown,
	options?: PersistStateOptions,
): StateMap<Record<string, unknown>> & CreatePersistStateFn | Signal<unknown> {
	if (arguments.length === 0 || shapeOrValue === undefined) {
		return createState() as Signal<undefined>;
	}
	if (isRpcRunRef(shapeOrValue)) {
		return createState(shapeOrValue) as Signal<unknown>;
	}
	if (isPlainObject(shapeOrValue as object)) {
		const shape = shapeOrValue as Record<string, unknown>;
		const store = buildStore(shape);
		if (options?.storageKey) {
			bindPersistIdb(store as Record<string, unknown>, options.storageKey);
		} else {
			bindManagedStore(store as Record<string, unknown>, shape, "persist");
		}
		const fn = ((other?: unknown, o?: PersistStateOptions) => createPersistStateImpl(other, o)) as CreatePersistStateFn;
		return withCallableStore(fn, store as Record<string, unknown>) as StateMap<Record<string, unknown>> & CreatePersistStateFn;
	}
	return createState(shapeOrValue) as Signal<unknown>;
}
