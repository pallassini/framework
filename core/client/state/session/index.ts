import { isRpcRunRef } from "../../../desktop/rpc-ref";
import { type Signal } from "../state/signal";
import { buildStore, isPlainObject, type StateMap } from "../utils/store";
import { withCallableStore } from "../utils/withCallableStore";
import { bindManagedStore } from "../utils/globalStoreMeta";
import { bindSessionIdb } from "./storage";
import { createState } from "../state/createState";

export type SessionStateOptions = { storageKey?: string };

let counter = 0;

type CreateSessionStateFn = {
	<U extends Record<string, unknown>>(shape: U, options?: SessionStateOptions): StateMap<U>;
	<V>(value: V): Signal<V>;
};

function createSessionStateImpl(shapeOrValue: unknown, opts?: SessionStateOptions): StateMap<Record<string, unknown>> | Signal<unknown> {
	if (arguments.length === 0 || shapeOrValue === undefined) {
		return createState() as Signal<unknown>;
	}
	if (isRpcRunRef(shapeOrValue)) {
		return createState(shapeOrValue) as unknown as Signal<unknown>;
	}
	if (isPlainObject(shapeOrValue)) {
		const s = buildStore(shapeOrValue as Record<string, unknown>);
		bindSessionIdb(s as Record<string, unknown>, opts?.storageKey ?? `local.${++counter}`);
		return s as StateMap<Record<string, unknown>>;
	}
	return createState(shapeOrValue) as Signal<unknown>;
}

export function createSessionState<T extends Record<string, unknown>>(
	shape: T,
	options?: SessionStateOptions,
): StateMap<T> & CreateSessionStateFn;
export function createSessionState<T>(value: T): Signal<T>;
export function createSessionState(
	shapeOrValue?: unknown,
	options?: SessionStateOptions,
): StateMap<Record<string, unknown>> & CreateSessionStateFn | Signal<unknown> {
	if (arguments.length === 0 || shapeOrValue === undefined) {
		return createState() as Signal<unknown>;
	}
	if (isRpcRunRef(shapeOrValue)) {
		return createState(shapeOrValue) as unknown as Signal<unknown>;
	}
	if (isPlainObject(shapeOrValue as object)) {
		const shape = shapeOrValue as Record<string, unknown>;
		const store = buildStore(shape);
		if (options?.storageKey) {
			bindSessionIdb(store as Record<string, unknown>, options.storageKey);
		} else {
			bindManagedStore(store as Record<string, unknown>, shape, "session");
		}
		const fn = ((other?: unknown, o?: SessionStateOptions) => createSessionStateImpl(other, o)) as CreateSessionStateFn;
		return withCallableStore(
			fn as (...args: unknown[]) => unknown,
			store as Record<string, unknown>,
		) as StateMap<Record<string, unknown>> & CreateSessionStateFn;
	}
	return createState(shapeOrValue) as Signal<unknown>;
}
