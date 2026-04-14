import type { Properties } from "csstype";
import { resolveColorToken } from "./utils/color";
import { CSS_LENGTH_RE, isCssVarToken, isSpacingKeyword } from "./utils/units";

/** Passi **4–12** → `font-size` in `rem`; lunghezze esplicite come `text-11px`. */
const TEXT_SIZE: Record<number, string> = {
	4: "0.8125rem",
	5: "0.875rem",
	6: "1rem",
	7: "1.125rem",
	8: "1.25rem",
	9: "1.375rem",
	10: "1.5rem",
	11: "1.625rem",
	12: "1.75rem",
};

/** `text-#fff` → `color`; `text-4`…`text-12`, `text-11px` → `fontSize`. Peso: `font-4`… */
export function text(suffix: string): Properties | undefined {
	if (!suffix) return undefined;

	const color = resolveColorToken(suffix);
	if (color) return { color: color };

	if (isSpacingKeyword(suffix)) return undefined;
	if (CSS_LENGTH_RE.test(suffix)) return { fontSize: suffix };
	if (isCssVarToken(suffix)) return { fontSize: suffix };
	if (/^\d+$/.test(suffix)) {
		const n = Number(suffix);
		const sz = TEXT_SIZE[n];
		if (sz) return { fontSize: sz };
	}

	return undefined;
}
