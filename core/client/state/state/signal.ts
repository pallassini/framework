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

/**
 * `AutoSignal<T>`: Signal con accesso reattivo alle property. Per es.
 * con `state(promise)` → `data.resources` è un Signal derivato che estrae
 * `v?.resources` dal valore corrente. Le property sono create lazy alla
 * prima lettura e memoizzate.
 */
type AutoProps<T> =
	NonNullable<T> extends readonly unknown[]
		? {}
		: NonNullable<T> extends object
			? {
					readonly [K in Exclude<
						keyof NonNullable<T>,
						// keys riservate a SignalBase (shadowing)
						"value" | "valueOf" | "toString" | "get" | "reset"
					>]-?: AutoSignal<NonNullable<T>[K] | Extract<T, null | undefined>>;
				}
			: {};

export type AutoSignal<T> = SignalBase<T> & AutoProps<T>;

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

function signalFromPromise<T>(p: PromiseLike<T>): AutoSignal<T | undefined> {
	const [get, set] = watch.source(undefined as T | undefined);
	void Promise.resolve(p).then(
		(v) => {
			set(v);
		},
		() => {
			set(undefined);
		},
	);
	const sig = finalizeSignal(get, set, undefined as T | undefined);
	return autoDeriveProxy(sig) as AutoSignal<T | undefined>;
}

/**
 * Property sul signal riservate al core (non creano derived signal).
 * Note: `then/catch/finally` sono escluse per non far confondere il
 * proxy con un thenable (rompe `await sig`).
 */
const RESERVED_STRING_KEYS = new Set<string>([
	"value",
	"valueOf",
	"toString",
	"get",
	"reset",
	"length",
	"name",
	"prototype",
	"apply",
	"call",
	"bind",
	"then",
	"catch",
	"finally",
	"constructor",
	/** `state(rpcGet)` attacca metodi sul target; il proxy altrimenti li confonde con chiavi sui dati. */
	"create",
	"update",
	"remove",
	"refetch",
]);

function autoDeriveProxy<T>(sig: Signal<T>): Signal<T> {
	const cache = new Map<string, Signal<unknown>>();
	return new Proxy(sig as unknown as object, {
		get(target, prop, receiver) {
			if (typeof prop === "symbol" || RESERVED_STRING_KEYS.has(prop)) {
				return Reflect.get(target, prop, receiver);
			}
			const key = prop;
			let derived = cache.get(key);
			if (!derived) {
				derived = signal(() => {
					const v = (sig as () => unknown)();
					if (v == null) return undefined;
					return (v as Record<string, unknown>)[key];
				}) as Signal<unknown>;
				derived = autoDeriveProxy(derived);
				cache.set(key, derived);
			}
			return derived;
		},
	}) as Signal<T>;
}

export function signal(): Signal<unknown>;
export function signal<T>(initial: Promise<T>): AutoSignal<T | undefined>;
export function signal<T>(initial: PromiseLike<T>): AutoSignal<T | undefined>;
export function signal<R>(initial: () => Promise<R>): AutoSignal<R | undefined>;
/** Funzione sincrona → segnale derivato (legge altri signal in `compute`). */
export function signal<R>(compute: () => R): Signal<R>;
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
		const compute = v as () => T;
		let r: unknown;
		try {
			r = compute();
		} catch {
			const [get, set] = watch.source(v as T);
			return finalizeSignal(get, set, v as T);
		}
		if (isPromiseLike(r)) {
			return signalFromPromise(r as PromiseLike<Awaited<T>>) as Signal<T | undefined>;
		}
		/** Funzione sincrona → segnale derivato (dipendenze da altri signal letti in `compute`). */
		const [get, set] = watch.source(r as T);
		watch(
			() => {
				set(compute());
			},
			{ flush: "sync" },
		);
		return finalizeSignal(get, set, r as T);
	}

	const [get, set] = watch.source(v as T);
	return finalizeSignal(get, set, v as T);
}
