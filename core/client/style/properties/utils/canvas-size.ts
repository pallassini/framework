/**
 * Scala "canvas di design": `w-N` / `h-N` con `N` intero `1-100` → rem calcolati su un canvas di
 * riferimento (default 1920×1080, 1rem = 16px).
 *
 * Esempio con 1920×1080 e 16px/rem:
 * - `w-70` → 70% di 1920px = 1344px = **84rem**
 * - `h-50` → 50% di 1080px = 540px = **33.75rem**
 *
 * Vantaggio su `vw`/`vh`: su schermi più grandi del canvas NON esplode (stabile),
 * rispetta zoom utente (rem) e resta proporzionato al design originale.
 */
export type CanvasSizeConfig = {
	/** Larghezza del canvas di design in px (default 1920). */
	width: number;
	/** Altezza del canvas di design in px (default 1080). */
	height: number;
	/** Valore `rem` root in px (default 16). */
	remPx: number;
};

const DEFAULT: CanvasSizeConfig = { width: 1920, height: 1080, remPx: 16 };

let canvasConfig: CanvasSizeConfig = DEFAULT;

export function setClientCanvasSize(cfg: Partial<CanvasSizeConfig> | undefined): void {
	canvasConfig = { ...DEFAULT, ...(cfg ?? {}) };
}

const INT_1_100_RE = /^[1-9]\d?$|^100$/;

function toRem(px: number): string {
	const rem = px / canvasConfig.remPx;
	return `${Number(rem.toFixed(4))}rem`;
}

/** Suffisso `1`…`100` → rem su asse X (larghezza canvas). */
export function resolveCanvasWidthSuffix(s: string): string | null {
	if (!INT_1_100_RE.test(s)) return null;
	const pct = Number(s);
	return toRem((canvasConfig.width * pct) / 100);
}

/** Suffisso `1`…`100` → rem su asse Y (altezza canvas). */
export function resolveCanvasHeightSuffix(s: string): string | null {
	if (!INT_1_100_RE.test(s)) return null;
	const pct = Number(s);
	return toRem((canvasConfig.height * pct) / 100);
}
