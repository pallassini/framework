/**
 * Normalizza il secondo argomento di `state(rpcGet, opts)`:
 * - di default è **lo stesso oggetto** che passeresti a `server.*.get(opts)` (es. `{ where: { … } }`, `{ deletedAt: null }`);
 * - compat: `{ getInput: { … } }` (solo quella chiave) viene ancora accettato.
 */
export type RpcGetCallArgs = Record<string, unknown>;

export function takeRpcGetCallArgs(opts?: RpcGetCallArgs): RpcGetCallArgs | undefined {
	if (opts == null) return undefined;
	const keys = Object.keys(opts);
	if (keys.length === 0) return undefined;
	if (keys.length === 1 && keys[0] === "getInput") {
		const inner = (opts as { getInput?: RpcGetCallArgs }).getInput;
		if (inner == null || typeof inner !== "object" || Array.isArray(inner)) return undefined;
		const ik = Object.keys(inner);
		return ik.length === 0 ? undefined : (inner as RpcGetCallArgs);
	}
	return opts;
}
