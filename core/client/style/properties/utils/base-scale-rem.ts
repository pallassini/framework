import { styleViewport } from "../../viewport";

/**
 * Scala spacing `base` (stessa progressione documentata in `client/config.ts`):
 * - **1–20**: +0.25rem/step → `1`=0.25rem, `20`=5rem
 * - **21–40**: +0.5rem/step → `30`=10rem, `40`=15rem
 * - **41–100**: +1rem/step → `50`=25rem, `100`=75rem
 * Valori `mob`/`tab` = 75% / 87.5% di `des`.
 */
export function baseRemDes(n: number): number {
	if (n < 1 || n > 100) return NaN;
	if (n <= 20) return n * 0.25;
	if (n <= 40) return 5 + (n - 20) * 0.5;
	return 15 + (n - 40) * 1;
}

function remStr(desRem: number): string {
	return `${Number(desRem.toFixed(4))}rem`;
}

/**
 * `w-N` / `h-N` (percentuale canvas in rem “design”): stessi fattori di `baseViewportRow`
 * così su `mob` / `tab` le larghezze in rem non restano identiche al desktop.
 */
export function desRemScaledToCurrentViewport(desRem: number): string {
	const vp = styleViewport();
	const factor = vp === "mob" ? 0.75 : vp === "tab" ? 0.875 : 1;
	return remStr(desRem * factor);
}

export function baseViewportRow(n: number): { mob: string; tab: string; des: string } | null {
	const des = baseRemDes(n);
	if (Number.isNaN(des)) return null;
	return {
		des: remStr(des),
		mob: remStr(des * 0.75),
		tab: remStr(des * 0.875),
	};
}

/** Chiavi `"1"`…`"100"` per `clientConfig.style.base` (introspection / config). */
export function buildBaseScaleMap(): Record<string, { mob: string; tab: string; des: string }> {
	const out: Record<string, { mob: string; tab: string; des: string }> = {};
	for (let i = 1; i <= 100; i++) {
		const row = baseViewportRow(i);
		if (row) out[String(i)] = row;
	}
	return out;
}
