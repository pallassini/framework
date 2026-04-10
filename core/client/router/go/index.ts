/** Same event `App` listens to so `go()`, link clicks, and history stay aligned. */
export const NAVIGATE_EVENT = "fw:navigate" as const;

export function go(path: string, replace = false): void {
	if (location.pathname + location.search === path) return;
	if (replace) history.replaceState(null, "", path);
	else history.pushState(null, "", path);
	window.dispatchEvent(new CustomEvent<string>(NAVIGATE_EVENT, { detail: path }));
}
