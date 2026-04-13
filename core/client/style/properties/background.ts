import type { Properties } from "csstype";
import { resolveColorToken } from "./utils/color";

export function backgroundColor(suffix: string): Properties | undefined {
	if (!suffix) return undefined;
	const c = resolveColorToken(suffix);
	return c ? { backgroundColor: c } : undefined;
}
