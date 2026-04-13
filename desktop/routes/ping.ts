import { d } from "desktop";

/** RPC desktop `ping` → `view.rpc.request.ping(...)` */
export default d({
	run() {
		return { ok: true as const, from: "desdwdwwdedwdwdwktfefeop" as const };
	},
});

export const prova2 = d({
	run() {
		return { ok: true as const, from: "desdwdwdedwktfefeop" as const };
	},
});