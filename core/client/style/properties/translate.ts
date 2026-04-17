import type { Properties } from "csstype";
import { resolveSpacingToken } from "./utils/units";

/** `tx-12px` / `-tx-50%` → `translateX` (suffisso come margin / lunghezze CSS). */
export function translateX(suffix: string, ctx?: { negative?: boolean }): Properties | undefined {
	const v = resolveSpacingToken(suffix, "x", ctx?.negative);
	return v ? { transform: `translateX(${v})` } : undefined;
}

/** `ty-12px` / `-ty-50%` → `translateY`. */
export function translateY(suffix: string, ctx?: { negative?: boolean }): Properties | undefined {
	const v = resolveSpacingToken(suffix, "y", ctx?.negative);
	return v ? { transform: `translateY(${v})` } : undefined;
}
