import type { Properties } from "csstype";
import { FW_BACKDROP_PARTS } from "../fw-backdrop-parts-symbol";
import { CSS_LENGTH_RE } from "./utils/units";

function backdropSegment(fn: string): Properties {
	return { [FW_BACKDROP_PARTS]: [fn] } as unknown as Properties;
}

/** Intero puro → `blur(Npx)`; altrimenti lunghezza CSS (`1rem`, …). */
export function bgBlur(suffix: string): Properties | undefined {
	const s = suffix.trim();
	if (!s) return undefined;
	if (/^\d+$/.test(s)) return backdropSegment(`blur(${s}px)`);
	if (CSS_LENGTH_RE.test(s) || s === "0") return backdropSegment(`blur(${s})`);
	return undefined;
}

/** Suffisso come in CSS: `180%`, oppure moltiplicatore `1.65` (con punto decimale). */
export function bgSaturate(suffix: string): Properties | undefined {
	const s = suffix.trim();
	if (!s) return undefined;
	if (s.includes("%")) return backdropSegment(`saturate(${s})`);
	if (/^\d+\.\d+$/.test(s)) return backdropSegment(`saturate(${s})`);
	if (/^\d+$/.test(s)) return backdropSegment(`saturate(${s}%)`);
	return undefined;
}

/** `1.05`, `105%`, … → `brightness(…)`. */
export function bgBrightness(suffix: string): Properties | undefined {
	const s = suffix.trim();
	if (!s) return undefined;
	if (s.includes("%")) return backdropSegment(`brightness(${s})`);
	if (/^\d+\.\d+$/.test(s)) return backdropSegment(`brightness(${s})`);
	if (/^\d+$/.test(s)) return backdropSegment(`brightness(${s}%)`);
	return undefined;
}

/** `1.1`, `110%`, … → `contrast(…)`. */
export function bgContrast(suffix: string): Properties | undefined {
	const s = suffix.trim();
	if (!s) return undefined;
	if (s.includes("%")) return backdropSegment(`contrast(${s})`);
	if (/^\d+\.\d+$/.test(s)) return backdropSegment(`contrast(${s})`);
	if (/^\d+$/.test(s)) return backdropSegment(`contrast(${s}%)`);
	return undefined;
}

/** `12deg` oppure `12` / `-6` → `hue-rotate(…deg)`. */
export function bgHueRotate(suffix: string): Properties | undefined {
	let s = suffix.trim();
	if (!s) return undefined;
	if (!/deg$/i.test(s)) s = `${s}deg`;
	if (!/^-?[\d.]+deg$/i.test(s)) return undefined;
	return backdropSegment(`hue-rotate(${s})`);
}
