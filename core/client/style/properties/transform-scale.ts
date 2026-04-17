import type { Properties } from "csstype";
import type { StyleResolver } from "../properties";

/**
 * `scale-130` → `scale(1.3)` (numeri ≥ 10 interpretati come percentuale/100); `scale-1` → `scale(1)`.
 */
export const scaleTransform: StyleResolver = (suffix: string): Properties | undefined => {
	const s = suffix.trim();
	if (!s) return undefined;
	const n = parseFloat(s);
	if (!Number.isFinite(n)) return undefined;
	const factor = n > 10 ? n / 100 : n;
	return { transform: `scale(${factor})` };
};
