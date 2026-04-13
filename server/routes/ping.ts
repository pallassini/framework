import { s } from "server";

/** RPC `ping` → `await server.ping()` */
export default s({
	run() {
		return { ok: true as const };
	},
});

/** RPC `ping.meta` → `await server.ping.meta()` */
export const brooo = s({
	run() {
		return { name: "pingddddwdw" as const };
	},
});
