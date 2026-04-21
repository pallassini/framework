/**
 * Scala **1–5** in **solo `rem`** (rispetta `font-size` della root / zoom utente).
 * - **x**: margini/padding orizzontali, `gapx`, `minw`
 * - **y**: margini/padding verticali, `gapy`
 * - **box**: `p`, `m`, `gap`, `b` (spessore)
 * - **radius**: `round-*` (numeri se `clientConfig.style.round` assente)
 * - **icon**: lato icona (passi un po’ più generosi dello spacing)
 * - **base-N**: scala fluida da `clientConfig.style.base` (`p-base-4`, `gap-base-2`, …)
 */
export type SpacingScaleKind = "x" | "y" | "box" | "radius" | "icon";

type ScaleStep = 1 | 2 | 3 | 4 | 5;

const STEP_RE = /^[1-5]$/;

/** Passo 1–5 → valore `rem` o `null`. */
export function scaleStep(kind: SpacingScaleKind, step: number): string | null {
	if (step < 1 || step > 5) return null;
	const key = step as ScaleStep;
	switch (kind) {
		case "x":
			return SPACE_X[key];
		case "y":
			return SPACE_Y[key];
		case "box":
			return SPACE_BOX[key];
		case "radius":
			return RADIUS[key];
		case "icon":
			return ICON[key];
		default:
			return null;
	}
}

export function parseScaleSuffix(suffix: string): number | null {
	if (!STEP_RE.test(suffix)) return null;
	return Number(suffix);
}

/* --- Curve (passi 1–5, chiavi esplicite) --- */

const SPACE_X: Record<ScaleStep, string> = {
	1: "0.25rem",
	2: "0.375rem",
	3: "0.5625rem",
	4: "0.75rem",
	5: "1rem",
};

const SPACE_Y: Record<ScaleStep, string> = {
	1: "0.25rem",
	2: "0.375rem",
	3: "0.5625rem",
	4: "0.75rem",
	5: "1rem",
};

const SPACE_BOX: Record<ScaleStep, string> = {
	1: "0.25rem",
	2: "0.4375rem",
	3: "0.625rem",
	4: "0.875rem",
	5: "1.25rem",
};

const RADIUS: Record<ScaleStep, string> = {
	1: "0.1875rem",
	2: "0.3125rem",
	3: "0.4375rem",
	4: "0.5625rem",
	5: "0.75rem",
};

const ICON: Record<ScaleStep, string> = {
	1: "1rem",
	2: "1.3125rem",
	3: "1.625rem",
	4: "1.9375rem",
	5: "2.375rem",
};
