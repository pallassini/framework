export function withCallableStore<C extends (...args: unknown[]) => unknown>(
	call: C,
	store: Record<string, unknown>,
): C & Record<string, unknown> {
	return new Proxy(call as C & Record<string, unknown>, {
		apply(_target, thisArg, args) {
			return call.apply(thisArg, args as Parameters<C>);
		},
		get(_target, prop, receiver) {
			if (typeof prop === "string" && Object.prototype.hasOwnProperty.call(store, prop)) {
				return (store as Record<string, unknown>)[prop];
			}
			return Reflect.get(call, prop, receiver);
		},
		has(_target, prop) {
			if (typeof prop === "string" && prop in store) return true;
			return Reflect.has(call, prop);
		},
		ownKeys() {
			return Reflect.ownKeys(store);
		},
		getOwnPropertyDescriptor(_target, prop) {
			if (typeof prop === "string" && Object.prototype.hasOwnProperty.call(store, prop)) {
				return {
					configurable: true,
					enumerable: true,
					value: (store as Record<string, unknown>)[prop],
					writable: true,
				};
			}
			return Reflect.getOwnPropertyDescriptor(call, prop);
		},
	});
}
