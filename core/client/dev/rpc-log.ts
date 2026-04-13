/** Prefisso attenuato in DevTools (renderer), coerente col log RPC in terminale. */
export function logWithRpcTag(tag: "server" | "desktop", ...args: unknown[]): void {
	console.log(`%c[${tag}]%c`, "color:#5a5a5a;font-weight:500", "color:inherit", ...args);
}
