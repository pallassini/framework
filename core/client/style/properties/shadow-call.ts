import type { Properties } from "csstype";
import { B_ANIM_FILL, B_ANIM_RGB, parseColorToken } from "./b-animated";

/**
 * Colore per `box-shadow`: preset tema → RGBA; hex/nome → `parseColorToken`.
 * `opacity` moltiplica l’alpha del colore (anche hex 8 cifre).
 */
function resolveShadowPaint(token: string, opacity: number): string | undefined {
	const t = token.trim();
	const low = t.toLowerCase();
	const fillVar = B_ANIM_FILL[low as keyof typeof B_ANIM_FILL];
	const rgbPreset = B_ANIM_RGB[low as keyof typeof B_ANIM_RGB];
	if (fillVar && rgbPreset) {
		const [r, g, b] = rgbPreset.split(" ").map(Number);
		return `rgba(${r}, ${g}, ${b}, ${Math.min(1, Math.max(0, opacity))})`;
	}
	if (fillVar && !rgbPreset) {
		return fillVar;
	}
	const p = parseColorToken(t);
	if (!p) return undefined;
	const [r, g, b] = p.trip.split(/\s+/).map(Number);
	return `rgba(${r}, ${g}, ${b}, ${Math.min(1, Math.max(0, opacity * p.alpha))})`;
}

type PosHint = "default" | "bottom" | "top" | "left" | "right" | "center";

type ShadowNamed = {
	blur?: number;
	spread?: number;
	ox?: number;
	oy?: number;
	opacity?: number;
	pos?: PosHint;
};

const POS_ALIASES: Record<string, PosHint> = {
	"pos-bottom": "bottom",
	"pos-top": "top",
	"pos-left": "left",
	"pos-right": "right",
	"pos-center": "center",
	bottom: "bottom",
	top: "top",
	left: "left",
	right: "right",
	center: "center",
};

function defaultOffsetAlongBlur(blur: number): number {
	return Math.max(2, Math.round(blur * 0.28));
}

/**
 * Offset: `x-4` / `y-4`, valore negativo anche come `x--4` / `y--4` oppure **`-x-4` / `-y-4`**.
 * Stesso schema con prefisso `offset-` (`offset-x-3`, `-offset-x-3`, …).
 */
function parseNamedShadowArg(raw: string, into: ShadowNamed): boolean {
	const p = raw.trim();
	const low = p.toLowerCase();

	const pos = POS_ALIASES[low];
	if (pos) {
		into.pos = pos;
		return true;
	}

	/** Suffisso opzionale `px` — usare `(?:px)?`, non `px?` (= lettera `p` + `x` opzionale). */
	let m = /^blur-(\d+(?:\.\d+)?)(?:px)?$/i.exec(p);
	if (m) {
		into.blur = Number(m[1]);
		return true;
	}

	m = /^spread-(-?\d+(?:\.\d+)?)(?:px)?$/i.exec(p);
	if (m) {
		into.spread = Number(m[1]);
		return true;
	}

	m = /^-(?:offset-)?x-(\d+(?:\.\d+)?)(?:px)?$/i.exec(p);
	if (m) {
		into.ox = -Number(m[1]);
		return true;
	}

	m = /^-(?:offset-)?y-(\d+(?:\.\d+)?)(?:px)?$/i.exec(p);
	if (m) {
		into.oy = -Number(m[1]);
		return true;
	}

	m = /^(?:offset-)?x-(-?\d+(?:\.\d+)?)(?:px)?$/i.exec(p);
	if (m) {
		into.ox = Number(m[1]);
		return true;
	}

	m = /^(?:offset-)?y-(-?\d+(?:\.\d+)?)(?:px)?$/i.exec(p);
	if (m) {
		into.oy = Number(m[1]);
		return true;
	}

	m = /^(?:opacity|op|a)-(\d*\.?\d+)$/i.exec(p);
	if (m) {
		into.opacity = Number(m[1]);
		return true;
	}

	return false;
}

function looksLegacyPositional(parts: string[]): boolean {
	if (parts.length < 2) return false;
	const second = parts[1]!.trim();
	return /^\d+(\.\d+)?$/.test(second);
}

/**
 * - **Legacy posizionale**: `shadow(colore, blur [, spread [, offsetY [, opacity]]])` (numeri puri dopo il colore).
 * - **Con nomi** (ordine libero dopo il colore): `shadow(colore, pos-bottom, blur-10, spread-2, y-14, x-0, opacity-0.45)`; offset negativo: **`y--6`**, **`x--4`** oppure **`-y-6`**, **`-x-4`**.
 *   Preset posizione: `pos-bottom` | `pos-top` | `pos-left` | `pos-right` | `pos-center` (anche `bottom`, `top`, …).
 *   Se manca `y`/`x` e c’è un preset, offset di default lungo quell’asse (≈ max(2px, blur×0.28)); con `pos-center` → 0, 0 se non specificati.
 */
export function resolveShadowCall(fullToken: string): Properties | undefined {
	const m = fullToken.match(/^shadow\s*\(\s*([\s\S]*)\s*\)\s*$/i);
	if (!m) return undefined;
	const parts = m[1]!
		.split(",")
		.map((p) => p.trim())
		.filter((p) => p.length > 0);
	if (parts.length < 2) return undefined;

	const colorTok = parts[0]!;

	if (looksLegacyPositional(parts)) {
		const blur = Number(parts[1]);
		if (Number.isNaN(blur) || blur < 0) return undefined;
		const spread = parts.length >= 3 ? Number(parts[2]) : 0;
		const sp = Number.isNaN(spread) ? 0 : spread;
		let offsetY: number;
		if (parts.length >= 4) {
			const oy = Number(parts[3]);
			offsetY = Number.isNaN(oy) ? defaultOffsetAlongBlur(blur) : oy;
		} else {
			offsetY = defaultOffsetAlongBlur(blur);
		}
		const opacity = parts.length >= 5 ? Number(parts[4]) : 0.42;
		const op = Number.isNaN(opacity) ? 0.42 : Math.min(1, Math.max(0, opacity));
		const paint = resolveShadowPaint(colorTok, op);
		if (!paint) return undefined;
		return { boxShadow: `0 ${offsetY}px ${blur}px ${sp}px ${paint}` };
	}

	const named: ShadowNamed = {};
	for (let i = 1; i < parts.length; i++) {
		if (!parseNamedShadowArg(parts[i]!, named)) return undefined;
	}

	const blur = named.blur;
	if (blur === undefined || Number.isNaN(blur) || blur < 0) return undefined;

	const sp = named.spread !== undefined && !Number.isNaN(named.spread) ? named.spread : 0;
	const pos = named.pos ?? "default";

	let ox = named.ox;
	let oy = named.oy;
	const along = defaultOffsetAlongBlur(blur);

	if (ox === undefined || oy === undefined) {
		const fillX = ox === undefined;
		const fillY = oy === undefined;
		switch (pos) {
			case "bottom":
				if (fillY) oy = along;
				if (fillX) ox = 0;
				break;
			case "top":
				if (fillY) oy = -along;
				if (fillX) ox = 0;
				break;
			case "left":
				if (fillX) ox = -along;
				if (fillY) oy = 0;
				break;
			case "right":
				if (fillX) ox = along;
				if (fillY) oy = 0;
				break;
			case "center":
				if (fillX) ox = 0;
				if (fillY) oy = 0;
				break;
			default:
				if (fillY) oy = along;
				if (fillX) ox = 0;
				break;
		}
	}

	ox = ox ?? 0;
	oy = oy ?? 0;

	const opacity = named.opacity;
	const op =
		opacity !== undefined && !Number.isNaN(opacity)
			? Math.min(1, Math.max(0, opacity))
			: 0.42;

	const paint = resolveShadowPaint(colorTok, op);
	if (!paint) return undefined;

	return {
		boxShadow: `${ox}px ${oy}px ${blur}px ${sp}px ${paint}`,
	};
}
