import type { Properties } from "csstype";
import { CSS_LENGTH_RE } from "./utils/units";

/** Suffisso lunghezza CSS (`10px`, `0.5rem`, …) → `filter: blur(…)`. */
export function blur(suffix: string): Properties | undefined {
	const s = suffix.trim();
	if (!s) return undefined;
	if (CSS_LENGTH_RE.test(s) || s === "0") return { filter: `blur(${s})` };
	return undefined;
}
