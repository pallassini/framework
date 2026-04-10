/** Marca i nodi store costruiti da `buildStore` (persist/session possono discriminare in sicurezza). */
export const STATE_BRANCH = Symbol.for("framework.stateBranch");

export function isStateBranch(x: unknown): x is Record<string, unknown> {
	return (
		typeof x === "object" &&
		x !== null &&
		(x as unknown as { [k: symbol]: boolean })[STATE_BRANCH] === true
	);
}
