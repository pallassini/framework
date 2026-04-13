/** Segna le funzioni RPC così `sessionState(rpcFn)` non le invoca come factory Promise. */
export const RPC_REF = Symbol.for("framework.rpc.ref");

export function markRpcRun<F extends (...args: unknown[]) => Promise<unknown>>(run: F): F {
	Object.defineProperty(run, RPC_REF, { value: true, enumerable: false, configurable: true });
	return run;
}

export function isRpcRunRef(x: unknown): x is (...args: unknown[]) => Promise<unknown> {
	return typeof x === "function" && Reflect.get(x as object, RPC_REF) === true;
}
