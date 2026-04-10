import { FW_NAV } from "../nav-signal";

/** SPA navigation for in-app link handling (same contract as `go`, without importing it). */
export function pushClientPath(path: string, replace = false): void {
	if (location.pathname + location.search === path) return;
	if (replace) history.replaceState(null, "", path);
	else history.pushState(null, "", path);
	window.dispatchEvent(new CustomEvent<string>(FW_NAV, { detail: path }));
}
