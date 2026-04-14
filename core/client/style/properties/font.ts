import type { Properties } from "csstype";

/** Passi **4–12** → `font-weight` (scala da regolare → bold). */
const STEP: Record<number, NonNullable<Properties["fontWeight"]>> = {
	4: 400,
	5: 500,
	6: 600,
	7: 700,
	8: 800,
	9: 900,
	10: 950,
	11: 975,
	12: 1000,
};

const KEYWORDS: Record<string, NonNullable<Properties["fontWeight"]>> = {
	normal: 400,
	medium: 500,
	semibold: 600,
	bold: 700,
	extrabold: 800,
	lighter: "lighter",
	bolder: "bolder",
};

/** `font-4`…`font-12`, `font-600`, `font-normal` / `font-bold`… */
export function font(suffix: string): Properties | undefined {
	if (!suffix) return undefined;

	const kw = KEYWORDS[suffix];
	if (kw !== undefined) return { fontWeight: kw };

	if (/^\d+$/.test(suffix)) {
		const n = Number(suffix);
		const step = STEP[n];
		if (step !== undefined) return { fontWeight: step };
		if (n >= 100 && n <= 1000) return { fontWeight: n };
	}

	return undefined;
}
