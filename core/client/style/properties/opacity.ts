import type { Properties } from "csstype";

/**
 * `opacity-0` … `opacity-100` → 0 … 1 (passi interi, come scala percentuale).
 * `opacity-0.5` … → valore 0–1 esplicito (suffisso con punto decimale).
 */
export function opacity(suffix: string, ctx?: { negative?: boolean }): Properties | undefined {
	if (ctx?.negative) return undefined;
	if (suffix.includes(".")) {
		const n = parseFloat(suffix);
		if (!Number.isFinite(n) || n < 0 || n > 1) return undefined;
		return { opacity: n };
	}
	if (/^\d+$/.test(suffix)) {
		const int = parseInt(suffix, 10);
		if (int >= 0 && int <= 100) return { opacity: int / 100 };
	}
	return undefined;
}
