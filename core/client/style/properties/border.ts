import type { Properties } from "csstype";
import { resolveColorToken } from "./utils/color";
import { resolveSpacingToken } from "./utils/units";

/** Larghezza (`b-2vh`, `b-1px`) o colore (`b-#fff`, `b-rgba(...)`). Senza suffisso: `1px solid`. */
export function border(suffix: string): Properties | undefined {
	if (!suffix) return { borderStyle: "solid", borderWidth: "1px" };

	const width = resolveSpacingToken(suffix, "box");
	if (width) return { borderStyle: "solid", borderWidth: width };

	const color = resolveColorToken(suffix);
	if (color) return { borderStyle: "solid", borderWidth: "1px", borderColor: color };

	return undefined;
}
