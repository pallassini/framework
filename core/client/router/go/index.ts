import { FW_NAV } from "../nav-signal";

const listeners = new Set<(path: string) => void>();

export const go = Object.assign(
	function go(path: string, replace = false): void {
		if (location.pathname + location.search === path) return;
		if (replace) history.replaceState(null, "", path);
		else history.pushState(null, "", path);
		window.dispatchEvent(new CustomEvent<string>(FW_NAV, { detail: path }));
		for (const fn of listeners) fn(path);
	},
	{
		listen(fn: (path: string) => void): () => void {
			listeners.add(fn);
			return () => listeners.delete(fn);
		},
	},
);
