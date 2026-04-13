import { d } from "desktop";

/** RPC desktop `ping` → `view.rpc.request.ping(...)` */
export default d({
	run() {
		return { ok: true as const, from: "desktop" as const };
	},
});
