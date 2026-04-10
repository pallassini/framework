import { isSignal, signal, type Signal } from "../state/signal";
import { STATE_BRANCH, isStateBranch } from "./meta";

export type StateMap<T> = {
	[K in keyof T | "reset"]: K extends "reset"
		? () => void
		: K extends keyof T
			? T[K] extends unknown[]
				? Signal<T[K]>
				: T[K] extends Record<string, unknown>
					? StateMap<T[K]>
					: Signal<T[K]>
			: never;
};

export function isPlainObject(x: unknown): x is Record<string, unknown> {
	return (
		typeof x === "object" &&
		x !== null &&
		!Array.isArray(x) &&
		Object.getPrototypeOf(x) === Object.prototype
	);
}

function isResettableNode(x: unknown): x is { reset(): void } {
	if (isSignal(x)) return true;
	return (
		typeof x === "object" &&
		x !== null &&
		"reset" in x &&
		typeof (x as { reset: unknown }).reset === "function"
	);
}

export function buildStore<T extends Record<string, unknown>>(shape: T): StateMap<T> {
	if (Object.prototype.hasOwnProperty.call(shape, "reset")) {
		throw new Error('[state] "reset" è riservato nello shape iniziale');
	}
	if (isStateBranch(shape)) {
		throw new Error("[state] questo oggetto è già uno store; non ri- wrappare");
	}

	const out = {} as StateMap<T>;
	for (const key of Object.keys(shape) as (keyof T)[]) {
		const val = shape[key];
		(out as Record<string, unknown>)[key as string] = isPlainObject(val)
			? buildStore(val as Record<string, unknown>)
			: signal(val);
	}

	const reset = (): void => {
		for (const key of Object.keys(out)) {
			const node = (out as Record<string, unknown>)[key];
			if (isResettableNode(node)) node.reset();
		}
	};

	Object.defineProperty(out, "reset", { value: reset, enumerable: false, writable: false });
	Object.defineProperty(out, STATE_BRANCH, { value: true, enumerable: false, writable: false });

	return out;
}

export function getStoreSnapshot(store: Record<string, unknown>): Record<string, unknown> {
	const out: Record<string, unknown> = {};
	for (const key of Object.keys(store)) {
		if (key === "reset") continue;
		const v = store[key];
		if (typeof v === "function" && "get" in v && typeof (v as { get: () => unknown }).get === "function") {
			out[key] = (v as { get: () => unknown }).get();
		} else if (isPlainObject(v) || isStateBranch(v)) {
			out[key] = getStoreSnapshot(v as Record<string, unknown>);
		} else {
			out[key] = v;
		}
	}
	return out;
}

export function setStoreFromSnapshot(
	store: Record<string, unknown>,
	snapshot: Record<string, unknown>,
): void {
	for (const key of Object.keys(snapshot)) {
		if (!(key in store) || key === "reset") continue;
		const storeVal = store[key];
		const snapVal = snapshot[key];
		if (typeof storeVal === "function" && "get" in storeVal) {
			(storeVal as unknown as (v: unknown) => void)(snapVal);
		} else if (
			(isPlainObject(storeVal) || isStateBranch(storeVal)) &&
			isPlainObject(snapVal)
		) {
			setStoreFromSnapshot(storeVal as Record<string, unknown>, snapVal as Record<string, unknown>);
		}
	}
}
