/**
 * Auto-generato da write-bundled-load.ts. Non modificare.
 */

import * as mod0 from "../../../desktop/routes/ping";

import { applyBundledDesktopRouteModules } from "./bundled-apply";

export async function loadBundledDesktopRoutes(): Promise<void> {
	await applyBundledDesktopRouteModules([
	{ relPath: "ping.ts", mod: mod0 as Record<string, unknown> },
	]);
}
