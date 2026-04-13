import { formatElapsedSince } from "./format-elapsed";

const ANSI_MUTED = "\x1b[90m\x1b[2m";
const ANSI_RESET = "\x1b[0m";

function ansiEnabled(): boolean {
	return process.env.NO_COLOR === undefined;
}

function mutedTag(kind: "server" | "desktop"): string {
	const t = `[${kind}]`;
	if (!ansiEnabled()) return t;
	return `${ANSI_MUTED}${t}${ANSI_RESET}`;
}

/** Una riga per terminale: tag attenuato, nome route e durata leggibili. */
export function logRpcSuccess(kind: "server" | "desktop", routeName: string, t0: number): void {
	const elapsed = formatElapsedSince(t0);
	console.log(`${mutedTag(kind)} ${routeName} · ${elapsed}`);
}

export function logRpcError(kind: "server" | "desktop", routeName: string, t0: number, err: unknown): void {
	console.error(`${mutedTag(kind)} ${routeName} · ${formatElapsedSince(t0)}`, err);
}
