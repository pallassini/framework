export type Accessor<T> = () => T;

export type WatchOptions = {
	name?: string;
	/** Solo questi accessor sottoscrivono; il corpo gira in untrack. */
	watch?: readonly Accessor<unknown>[];
	flush?: "sync" | "microtask";
	enabled?: Accessor<boolean>;
	onError?: (
		err: unknown,
		meta: { name?: string; phase: "run" | "cleanup" },
	) => void;
};

type Cleanup = () => void;

type Cell<T> = {
	_v: T;
	_eq: (a: T, b: T) => boolean;
	_obs: Set<Handle>;
};

type Handle = {
	_run: () => void | Cleanup;
	_opts: WatchOptions;
	_links: Set<Cleanup>;
	_cleanups: Cleanup[];
	disposed: boolean;
	scheduled: boolean;
	notify: () => void;
};

let batchDepth = 0;
const queued = new Set<Handle>();
let microtaskQueued = false;

/** Durante prefetch router: ogni `watch` creato viene smontato a fine blocco (come IDE). */
let prefetchWatchDisposers: Array<() => void> | null = null;

export function runWithPrefetchWatchCleanup<T>(fn: () => T): T {
	const bucket: Array<() => void> = [];
	const prev = prefetchWatchDisposers;
	prefetchWatchDisposers = bucket;
	try {
		return fn();
	} finally {
		prefetchWatchDisposers = prev;
		for (let i = bucket.length - 1; i >= 0; i--) {
			try {
				bucket[i]!();
			} catch {
				/* evita che un watch difettoso blocchi gli altri */
			}
		}
	}
}

let active: Handle | null = null;
let untrackDepth = 0;
let cleanupOwner: Handle | null = null;

function flushQueue(): void {
	const pending = [...queued];
	queued.clear();
	for (const h of pending) {
		if (!h.disposed && h.scheduled) runHandle(h);
	}
}

function schedule(h: Handle): void {
	if (h.disposed || h.scheduled) return;
	h.scheduled = true;
	const flush = h._opts.flush ?? "microtask";

	if (flush === "sync" && batchDepth === 0) {
		runHandle(h);
		return;
	}

	queued.add(h);
	if (batchDepth > 0) return;

	if (flush === "sync") {
		flushQueue();
		return;
	}

	if (!microtaskQueued) {
		microtaskQueued = true;
		queueMicrotask(() => {
			microtaskQueued = false;
			flushQueue();
		});
	}
}

function unlinkAll(h: Handle): void {
	for (const fn of h._links) fn();
	h._links.clear();
}

function runCleanups(h: Handle): void {
	const list = h._cleanups;
	h._cleanups = [];
	for (let i = list.length - 1; i >= 0; i--) {
		try {
			list[i]!();
		} catch (e) {
			const onErr = h._opts.onError;
			if (onErr) onErr(e, { name: h._opts.name, phase: "cleanup" });
			else throw e;
		}
	}
}

function runHandle(h: Handle): void {
	if (h.disposed) return;
	h.scheduled = false;

	unlinkAll(h);
	runCleanups(h);

	const accessors = h._opts.watch;
	const enabled = h._opts.enabled;

	const prevA = active;
	const prevC = cleanupOwner;
	active = h;
	cleanupOwner = h;

	try {
		if (accessors?.length) {
			for (const a of accessors) a();
			if (enabled && !enabled()) return;
			watchUntrack(() => {
				execBody(h);
			});
		} else {
			if (enabled && !enabled()) return;
			execBody(h);
		}
	} catch (e) {
		const onErr = h._opts.onError;
		if (onErr) onErr(e, { name: h._opts.name, phase: "run" });
		else throw e;
	} finally {
		cleanupOwner = prevC;
		active = prevA;
	}
}

function execBody(h: Handle): void {
	const ret = h._run();
	if (typeof ret === "function") h._cleanups.push(ret);
}

function trackCell<T>(c: Cell<T>): T {
	const h = active;
	if (h && untrackDepth === 0) {
		c._obs.add(h);
		h._links.add(() => {
			c._obs.delete(h);
		});
	}
	return c._v;
}

function bumpCell<T>(c: Cell<T>, next: T | ((prev: T) => T)): T {
	const resolved =
		typeof next === "function" ? (next as (prev: T) => T)(c._v) : next;
	if (!c._eq(c._v, resolved)) {
		c._v = resolved;
		for (const h of [...c._obs]) h.notify();
	}
	return c._v;
}

function makeHandle(
	run: () => void | Cleanup,
	opts: WatchOptions,
): Handle {
	const h: Handle = {
		_run: run,
		_opts: opts,
		_links: new Set(),
		_cleanups: [],
		disposed: false,
		scheduled: false,
		notify: () => schedule(h),
	};
	return h;
}

function mergeOpts(
	accessors: readonly Accessor<unknown>[] | undefined,
	base: WatchOptions,
): WatchOptions {
	return accessors?.length
		? { ...base, watch: accessors }
		: base;
}

function parseArgs(
	fn: () => void | Cleanup,
	second?: readonly Accessor<unknown>[] | WatchOptions,
	third?: WatchOptions,
): { run: typeof fn; opts: WatchOptions } {
	if (second === undefined) return { run: fn, opts: {} };
	if (Array.isArray(second))
		return { run: fn, opts: mergeOpts(second, third ?? {}) };
	const opts = second as WatchOptions;
	const acc = opts.watch;
	return { run: fn, opts: mergeOpts(acc ? [...acc] : undefined, opts) };
}

function watchImpl(
	fn: () => void | Cleanup,
	second?: readonly Accessor<unknown>[] | WatchOptions,
	third?: WatchOptions,
): () => void {
	const { run, opts } = parseArgs(fn, second, third);
	const h = makeHandle(run, opts);
	runHandle(h);

	const disposer = (): void => {
		if (h.disposed) return;
		h.disposed = true;
		queued.delete(h);
		unlinkAll(h);
		runCleanups(h);
	};
	if (prefetchWatchDisposers) prefetchWatchDisposers.push(disposer);
	return disposer;
}

function watchSource<T>(
	initial: T,
	options?: {
		equals?: false | ((a: T, b: T) => boolean);
	},
): [Accessor<T>, (v: T | ((prev: T) => T)) => T] {
	const eq =
		options?.equals === false
			? () => false
			: (options?.equals ?? Object.is);
	const c: Cell<T> = {
		_v: initial,
		_eq: eq as (a: T, b: T) => boolean,
		_obs: new Set(),
	};
	return [
		() => trackCell(c),
		(v) => bumpCell(c, v),
	];
}

function watchUntrack<T>(fn: () => T): T {
	untrackDepth++;
	try {
		return fn();
	} finally {
		untrackDepth--;
	}
}

function watchOnCleanup(fn: Cleanup): void {
	if (!cleanupOwner) {
		throw new Error("watch.onCleanup fuori da watch()");
	}
	cleanupOwner._cleanups.push(fn);
}

function watchBatch(fn: () => void): void {
	batchDepth++;
	try {
		fn();
	} finally {
		batchDepth--;
		if (batchDepth === 0) flushQueue();
	}
}

function watchPeek<T>(read: Accessor<T>): T {
	return watchUntrack(read);
}

export const watch = Object.assign(watchImpl, {
	source: watchSource,
	untrack: watchUntrack,
	onCleanup: watchOnCleanup,
	batch: watchBatch,
	peek: watchPeek,
});
