import { d } from "desktop";
import { v } from "client";
import type { DesktopContext } from "../../../core/desktop/routes/context";
import { openDesktopWebWindow } from "../../../core/desktop/dev-windows";

/** RPC `desktop._devtools({ path })` → apre una finestra sul dev server (es. `/_devtools`). */
export default d({
	input: v.object({ path: v.string() }),
	run(input: { path: string }, _ctx: DesktopContext) {
		openDesktopWebWindow(input.path);
	},
});

export const p = d({
	run() {
		return { ok: true as const, from: "desdwdwwdedwdwddwdgrgrwdfefefewkfefefetfefeop" as const };
	},
});
