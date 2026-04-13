import { existsSync, mkdirSync, readFileSync, unlinkSync, watch } from "node:fs";
import { join } from "node:path";

let impl: ((path: string) => void) | null = null;

export function registerOpenDesktopWebWindow(fn: (path: string) => void): void {
	impl = fn;
}

export function openDesktopWebWindow(path: string): void {
	impl?.(path);
}

const SIGNAL_NAME = "open-webview";

/**
 * Il processo `bun dev` scrive un file in core/.dev (tasto E); Electrobun non condivide stdin col parent, quindi usiamo questo watch per aprire un’altra finestra.
 */
export function setupDevDesktopExtraWindowSignal(projectRoot: string): void {
	const dir = join(projectRoot, "core", ".dev");
	const file = join(dir, SIGNAL_NAME);
	mkdirSync(dir, { recursive: true });
	let debounce: ReturnType<typeof setTimeout> | undefined;
	watch(dir, { persistent: true }, () => {
		if (debounce != null) clearTimeout(debounce);
		debounce = setTimeout(() => {
			debounce = undefined;
			if (!existsSync(file)) return;
			let pathLine = "/_devtools";
			try {
				const raw = readFileSync(file, "utf8").trim();
				pathLine = raw.split("\n")[0]?.trim() || "/_devtools";
			} catch {
				/* */
			}
			try {
				unlinkSync(file);
			} catch {
				/* */
			}
			const p = pathLine.startsWith("/") ? pathLine : `/${pathLine}`;
			openDesktopWebWindow(p);
		}, 80);
	});
}
