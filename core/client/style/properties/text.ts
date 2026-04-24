import type { Properties } from "csstype";
import type { StyleViewport } from "../viewport";
import { styleViewport } from "../viewport";
import { resolveColorToken } from "./utils/color";
import { CSS_LENGTH_RE, isCssVarToken, isSpacingKeyword } from "./utils/units";

/** Scala tipografica da `clientConfig.style.text`: chiave = suffisso (`text-2` → `"2"`), valori per viewport. */
export type ClientTextScale = Record<string, Partial<Record<StyleViewport, string>>>;

let clientTextScale: ClientTextScale | undefined;

export function setClientTextScale(scale: ClientTextScale | undefined): void {
	clientTextScale = scale;
}

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

/** `text-#fff` → `color`; token da config (`text-2`); poi `text-4`…`text-12`, `text-11px` → `fontSize`. Peso: `font-4`… */
const TEXT_ALIGN: ReadonlySet<string> = new Set([
	"left",
	"right",
	"center",
	"justify",
	"start",
	"end",
]);

export function text(suffix: string): Properties | undefined {
	if (!suffix) return undefined;

	if (TEXT_ALIGN.has(suffix)) {
		return { textAlign: suffix as NonNullable<Properties["textAlign"]> };
	}

	const color = resolveColorToken(suffix);
	if (color) return { color: color };

	if (clientTextScale) {
		const row = clientTextScale[suffix];
		if (row) {
			const vp = styleViewport();
			// Se manca la chiave per il viewport corrente: tab → des → mob.
			const fontSize = row[vp] ?? row.tab ?? row.des ?? row.mob;
			if (fontSize) return { fontSize };
		}
	}

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
