import type { Properties } from "csstype";
import type { StyleResolver } from "../properties";

const CSS_LENGTH_TIME = /^[\d.]+(ms|s)$/i;

/**
 * `duration-200ms` / `duration-300` → durata.
 * Imposta anche `--duration`: il base-reset usa `transition-duration: var(--duration)` su `*`,
 * quindi i figli (es. nodi con `show`) ereditano la stessa durata del contenitore.
 */
export const transitionDurationToken: StyleResolver = (suffix: string): Properties | undefined => {
	const s = suffix.trim();
	if (!s) return undefined;
	const dur = CSS_LENGTH_TIME.test(s) ? s : `${s}ms`;
	return {
		transitionDuration: dur,
		"--duration": dur,
	} as Properties;
};

/** `ease` / `ease-out` / `ease-in` / `ease-in-out` → `transition-timing-function` (default CSS se solo `ease`). */
export const easeTiming: StyleResolver = (suffix: string): Properties | undefined => {
	const s = suffix.trim();
	if (!s) return { transitionTimingFunction: "ease" };
	const map: Record<string, string> = {
		out: "ease-out",
		in: "ease-in",
		"in-out": "ease-in-out",
	};
	const v = map[s];
	return v ? { transitionTimingFunction: v } : undefined;
};
