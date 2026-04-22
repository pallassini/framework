import { desRemScaledToCurrentViewport } from "./base-scale-rem";

/**
 * Scala "canvas di design": `w-N` / `h-N` con `N` = percentuale del canvas **0–100** (anche decimale: `w-1.2`, `h-3.7`).
 *
 * Esempio con 1920×1080 e 16px/rem (lato `des`):
 * - `w-70` → 70% di 1920px = 1344px = **84rem** su desktop
 * - `h-50` → 50% di 1080px = 540px = **33.75rem** su desktop
 *
 * Stessi fattori viewport di `clientConfig.style.base` (`mob` 75%, `tab` 87.5% del valore `des`),
 * così `w-10` su mobile non coincide con l’`rem` desktop.
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

const PCT_RE = /^\d+(\.\d+)?$/;

function parseCanvasPercent(s: string): number | null {
	if (!PCT_RE.test(s)) return null;
	const pct = parseFloat(s);
	if (pct <= 0 || pct > 100) return null;
	return pct;
}

function toRemFromCanvasPx(px: number): string {
	const desRem = px / canvasConfig.remPx;
	return desRemScaledToCurrentViewport(desRem);
}

/** Suffisso percentuale larghezza canvas (es. `12`, `1.2`, `99.5`) → rem su asse X. */
export function resolveCanvasWidthSuffix(s: string): string | null {
	const pct = parseCanvasPercent(s);
	if (pct == null) return null;
	return toRemFromCanvasPx((canvasConfig.width * pct) / 100);
}

/** Suffisso percentuale altezza canvas → rem su asse Y. */
export function resolveCanvasHeightSuffix(s: string): string | null {
	const pct = parseCanvasPercent(s);
	if (pct == null) return null;
	return toRemFromCanvasPx((canvasConfig.height * pct) / 100);
}
