/**
 * Atomo reattivo su `watch.source`: callable, Promise, .value, get/reset.
 */

import { watch } from "../effect";
import type { Accessor } from "../effect";

const SIGNAL = Symbol.for("framework.signal");

type SignalBase<T> = {
	(): T;
	(value: PromiseLike<T>): void;
	(value: T | ((prev: T) => T)): void;
	readonly value: T;
	valueOf(): T;
	toString(): string;
	get(): T;
	reset(): void;
};

export type Signal<T> = SignalBase<T> &
	(T extends string | number | boolean ? T : Record<string, never>);

export function isSignal(x: unknown): x is Signal<unknown> {
	return (
		typeof x === "function" &&
		(x as unknown as { [k: symbol]: boolean })[SIGNAL] === true
	);
}

function isPromiseLike(x: unknown): x is PromiseLike<unknown> {
	return (
		x != null &&
		(typeof x === "object" || typeof x === "function") &&
		typeof (x as PromiseLike<unknown>).then === "function"
	);
}

function finalizeSignal<T>(
	get: Accessor<T>,
	set: (v: T | ((p: T) => T)) => T,
	resetValue: T,
): Signal<T> {
	const signalFn = function (
		this: void,
		value?: T | ((prev: T) => T) | PromiseLike<T>,
	): T | void {
		if (arguments.length === 0) return get();
		const incoming = value as T | ((prev: T) => T) | PromiseLike<T>;
		if (isPromiseLike(incoming)) {
			void Promise.resolve(incoming).then((v) => {
				set(v as T);
			});
			return;
		}
		set(incoming as T | ((prev: T) => T));
	} as Signal<T> & { [SIGNAL]: true };

	Object.defineProperty(signalFn, "value", { get, enumerable: true });
	signalFn.valueOf = () => get();
	signalFn.toString = () => String(get());
	signalFn.get = get;
	signalFn.reset = () => set(resetValue);

	signalFn[SIGNAL] = true;
	return signalFn as Signal<T>;
}

function signalFromPromise<T>(p: PromiseLike<T>): Signal<T | undefined> {
	const [get, set] = watch.source(undefined as T | undefined);
	void Promise.resolve(p).then(
		(v) => {
			set(v);
		},
		() => {
			set(undefined);
		},
	);
	return finalizeSignal(get, set, undefined as T | undefined);
}

export function signal(): Signal<unknown>;
export function signal<T>(initial: Promise<T>): Signal<T | undefined>;
export function signal<T>(initial: PromiseLike<T>): Signal<T | undefined>;
export function signal<R>(initial: () => Promise<R>): Signal<R | undefined>;
export function signal<T>(initial: T): Signal<T>;
export function signal<T>(
	initial?: T,
): Signal<T | undefined> | Signal<T> | Signal<unknown> {
	if (arguments.length === 0) {
		const [get, set] = watch.source(undefined as unknown);
		return finalizeSignal(get, set, undefined as unknown);
	}

	const v = initial as unknown;

	if (isPromiseLike(v)) {
		return signalFromPromise(v as PromiseLike<Awaited<T>>) as Signal<T | undefined>;
	}

	if (typeof v === "function") {
		let r: unknown;
		try {
			r = (v as () => unknown)();
		} catch {
			const [get, set] = watch.source(v as T);
			return finalizeSignal(get, set, v as T);
		}
		if (isPromiseLike(r)) {
			return signalFromPromise(r as PromiseLike<Awaited<T>>) as Signal<T | undefined>;
		}
		const [get, set] = watch.source(v as T);
		return finalizeSignal(get, set, v as T);
	}

	const [get, set] = watch.source(v as T);
	return finalizeSignal(get, set, v as T);
}
