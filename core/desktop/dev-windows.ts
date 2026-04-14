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

function consumeOpenWebviewSignalFile(file: string): void {
	if (!existsSync(file)) return;
	let pathLine = "/_devtools";
	try {
		const raw = readFileSync(file, "utf8").trim();
		pathLine = raw.split("\n")[0]?.trim() || "/_devtools";
	} catch {
		return;
	}
	try {
		unlinkSync(file);
	} catch {
		/* */
	}
	const p = pathLine.startsWith("/") ? pathLine : `/${pathLine}`;
	openDesktopWebWindow(p);
}

/**
 * Il processo `bun dev` scrive un file in core/desktop/.dev (tasto E); Electrobun non condivide stdin col parent, quindi usiamo questo watch per aprire un’altra finestra.
 * All’avvio consumiamo anche un file già presente (E premuto mentre electrbun stava ancora partendo).
 */
export function setupDevDesktopExtraWindowSignal(projectRoot: string): void {
	const dir = join(projectRoot, "core", "desktop", ".dev");
	const file = join(dir, SIGNAL_NAME);
	mkdirSync(dir, { recursive: true });
	consumeOpenWebviewSignalFile(file);
	let debounce: ReturnType<typeof setTimeout> | undefined;
	watch(dir, { persistent: true }, () => {
		if (debounce != null) clearTimeout(debounce);
		debounce = setTimeout(() => {
			debounce = undefined;
			consumeOpenWebviewSignalFile(file);
		}, 80);
	});
}
