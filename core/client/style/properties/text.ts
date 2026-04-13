import type { Properties } from "csstype";
import { resolveColorToken } from "./utils/color";
import { resolveSpacingToken } from "./utils/units";

/** `text-11px` / `text-2vw` → `fontSize`; `text-#fff` → `color`. */
export function text(suffix: string): Properties | undefined {
	if (!suffix) return undefined;

	const size = resolveSpacingToken(suffix, "text");
	if (size) return { fontSize: size };

	const color = resolveColorToken(suffix);
	if (color) return { color: color };

	return undefined;
}
