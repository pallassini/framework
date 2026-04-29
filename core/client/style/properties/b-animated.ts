import type { Properties } from "csstype";

/** Tripletta `rgb(var(--*) / α)` — spazi tra i numeri. */
export const B_ANIM_RGB: Record<string, string> = {
	primary: "0 243 210",
	secondary: "140 140 150",
	white: "255 255 255",
	error: "255 37 37",
	background: "80 80 85",
};

/** Valore per `--fw-ab-fill` (hex o var). */
export const B_ANIM_FILL: Record<string, string> = {
	primary: "var(--primary)",
	secondary: "var(--secondary)",
	background: "var(--background)",
	error: "var(--error)",
	white: "#ffffff",
};

const MESH_B_DEFAULT = "200 255 248";

const FILL_FROM_BG = new Set(["from-bg", "use-bg", "face-bg"]);

/** Glow / palette: tripletta + moltiplicatore opacità (hex `#RRGGBBAA` → alpha da ultimi 2 nybble). */
export function parseColorToken(s: string): { trip: string; alpha: number } | undefined {
	const t = s.trim();
	const low = t.toLowerCase();
	if (B_ANIM_RGB[low]) return { trip: B_ANIM_RGB[low]!, alpha: 1 };
	const dash = /^(\d{1,3})-(\d{1,3})-(\d{1,3})$/.exec(t);
	if (dash) return { trip: `${dash[1]} ${dash[2]} ${dash[3]}`, alpha: 1 };

	const hexBody = (raw: string) => raw.replace(/^#/, "").toLowerCase();
	if (t.startsWith("#")) {
		const h = hexBody(t);
		if (h.length === 3 && /^[0-9a-f]+$/.test(h)) {
			const r = parseInt(h[0]! + h[0]!, 16);
			const g = parseInt(h[1]! + h[1]!, 16);
			const b = parseInt(h[2]! + h[2]!, 16);
			return { trip: `${r} ${g} ${b}`, alpha: 1 };
		}
		if (h.length === 6 && /^[0-9a-f]+$/.test(h)) {
			return {
				trip: `${parseInt(h.slice(0, 2), 16)} ${parseInt(h.slice(2, 4), 16)} ${parseInt(h.slice(4, 6), 16)}`,
				alpha: 1,
			};
		}
		if (h.length === 8 && /^[0-9a-f]+$/.test(h)) {
			const trip = `${parseInt(h.slice(0, 2), 16)} ${parseInt(h.slice(2, 4), 16)} ${parseInt(h.slice(4, 6), 16)}`;
			const a = parseInt(h.slice(6, 8), 16) / 255;
			return { trip, alpha: Math.min(1, Math.max(0, a)) };
		}
		return undefined;
	}
	if (/^[0-9a-f]{3}$/i.test(t) || /^[0-9a-f]{6}$/i.test(t) || /^[0-9a-f]{8}$/i.test(t)) return parseColorToken(`#${t}`);
	return undefined;
}

function resolveToRgbTriplet(s: string): string | undefined {
	return parseColorToken(s)?.trip;
}

function resolveFillCss(s: string): string | undefined {
	const t = s.trim();
	const low = t.toLowerCase();
	if (B_ANIM_FILL[low]) return B_ANIM_FILL[low];
	if (t.startsWith("#")) return t;
	if (/^[0-9a-f]{3}$/i.test(t) || /^[0-9a-f]{6}$/i.test(t) || /^[0-9a-f]{8}$/i.test(t)) return `#${t}`;
	const trip = resolveToRgbTriplet(t);
	return trip ? `rgb(${trip.replace(/ /g, " ")})` : undefined;
}

/** Compat con vecchi `aborder-power-1` … `5`. */
const B_ANIM_LEGACY_POWER: Record<number, string> = {
	1: "0.32",
	2: "0.48",
	3: "0.65",
	4: "0.82",
	5: "1",
};

/** Usato da `aborder-power-*` oltre il legacy e da argomenti decimali in `b-animated`. */
export function normalizeAnimatedPower(n: number): string {
	if (n > 1) return String(Math.min(1, Math.max(0.15, n / 10)));
	return String(Math.min(1, Math.max(0.15, n)));
}

/**
 * - `0–1` → intensità diretta (es. `0.85`).
 * - Interi `1–5` → tabella legacy (`3` = 0.65).
 * - `1–10` con decimali (es. `2.85`) → scala “forte”: ~`/3` fino a 1.
 * - Interi `6–10` → `/10`.
 */
function powerFromBAnimatedArg(raw: number): string {
	if (raw > 0 && raw <= 1) {
		return String(Math.min(1, Math.max(0.12, raw)));
	}
	if (raw === Math.floor(raw) && raw >= 1 && raw <= 5) {
		return B_ANIM_LEGACY_POWER[raw] ?? normalizeAnimatedPower(raw);
	}
	if (raw > 1 && raw <= 10) {
		if (raw !== Math.floor(raw)) {
			return String(Math.min(1, Math.max(0.35, raw / 3)));
		}
		return String(Math.min(1, Math.max(0.2, raw / 10)));
	}
	return normalizeAnimatedPower(raw);
}

function normalizeBlurMul(n: number): string {
	return String(Math.min(2.5, Math.max(0.35, n / 8)));
}

function normalizeModeToken(raw: string): "edge" | "mesh" | null {
	const l = raw.trim().toLowerCase();
	if (l === "edge" || l === "single") return "edge";
	if (l === "mesh" || l === "double") return "mesh";
	return null;
}

function isFillFromBgToken(s: string): boolean {
	return FILL_FROM_BG.has(s.trim().toLowerCase());
}

type KwSuffix = Partial<{
	blur: number;
	power: number;
	spread: number;
	durSec: number;
	speed: number;
}>;

function popKeywordSuffix(parts: string[]): KwSuffix {
	const out: KwSuffix = {};
	while (parts.length) {
		const last = parts[parts.length - 1]!;
		let m = /^(blur|power|spread)-([\d.]+)(?:px)?$/i.exec(last);
		if (m) {
			const k = m[1]!.toLowerCase();
			const v = Number(m[2]);
			if (Number.isNaN(v)) break;
			parts.pop();
			if (k === "blur") out.blur = v;
			else if (k === "power") out.power = v;
			else out.spread = v;
			continue;
		}
		m = /^dur-([\d.]+)(ms|s)?$/i.exec(last);
		if (m) {
			let sec = Number(m[1]);
			if (Number.isNaN(sec)) break;
			if ((m[2] || "").toLowerCase() === "ms") sec /= 1000;
			parts.pop();
			out.durSec = Math.min(120, Math.max(0.25, sec));
			continue;
		}
		m = /^speed-([\d.]+)$/i.exec(last);
		if (m) {
			const v = Number(m[1]);
			if (Number.isNaN(v) || v <= 0) break;
			parts.pop();
			out.speed = Math.min(8, Math.max(0.125, v));
			continue;
		}
		break;
	}
	return out;
}

const BASE_EDGE_DURATION_S = 15;
const BASE_MESH_DURATION_S = 5;

type FiveSlots = [string, string, string, string, string];
type FiveOpac = [number, number, number, number, number];

function fiveUniformSlots(trip: string, alpha: number): { slots: FiveSlots; opac: FiveOpac } {
	const a = Math.min(1, Math.max(0, alpha));
	const slots: FiveSlots = [trip, trip, trip, trip, trip];
	const opac: FiveOpac = [a, a, a, a, a];
	return { slots, opac };
}

function fiveSlotsFromPalette(tokens: string[]): { slots: FiveSlots; opac: FiveOpac } | undefined {
	const parsed = tokens.map((p) => parseColorToken(p.trim()));
	if (parsed.some((x) => x == null)) return undefined;
	const n = parsed.length;
	const slots: string[] = [];
	const opac: number[] = [];
	for (let i = 0; i < 5; i++) {
		const p = parsed[i % n]!;
		slots.push(p.trip);
		opac.push(p.alpha);
	}
	return { slots: slots as FiveSlots, opac: opac as FiveOpac };
}

function parseNumToken(s: string): number | undefined {
	const n = Number(s);
	return Number.isNaN(n) ? undefined : n;
}

/** Ordine in stringa: `potenza, blur` oppure `potenza, blur, spread`. */
function popLegacyNumericSuffix(parts: string[]): Partial<{ power: number; blur: number; spread: number }> | null {
	if (parts.length < 2) return null;
	const last = parseNumToken(parts[parts.length - 1]!);
	const mid = parseNumToken(parts[parts.length - 2]!);
	if (last === undefined || mid === undefined) return null;
	if (parts.length >= 3) {
		const third = parseNumToken(parts[parts.length - 3]!);
		if (third !== undefined) {
			parts.length -= 3;
			return { power: third, blur: mid, spread: last };
		}
	}
	parts.length -= 2;
	return { power: mid, blur: last };
}

const DEFAULT_POWER = 3;
const DEFAULT_BLUR = 8;

/**
 * `b-animated(modalità, colori…, opzioni)`
 *
 * - **Modalità:** `edge` | `single` (alone sul perimetro) · `mesh` | `double` (doppio radial).
 * - **Colori:** dopo la modalità; primo slot opzionale `from-bg` / `use-bg` / `face-bg` = faccia da `bg-*` sullo stesso `s` (merge in `layer-resolve`).
 *   - **single:** un colore = solo glow; due = faccia + glow.
 *   - **double:** uno = glow A (B default); due = glow A+B (faccia da bg/default); tre = faccia + A + B.
 * - **Opzioni:** `blur-*`, `power-*`, `spread-*`, **`dur-12`** / **`dur-5000ms`** (durata ciclo), **`speed-2`**
 *   (più alto = più veloce; scala sul default 15s edge / 5s mesh), in qualsiasi ordine in coda;
 *   oppure numeri legacy: `potenza, blur [, spread]`.
 * - **Multi-colore (solo `single`):** passi i colori **in ordine** — con **3+** token il **primo è la faccia**, il resto è la
 *   palette del glow (ripetuta lungo l’animazione). Esempio: `single, secondary, primary, white, blur-2`.
 *   Con **`from-bg`** e **2+** colori, tutti i colori sono solo palette. **`cycle`** resta opzionale se vuoi 2 soli colori
 *   in palette senza faccia nel token: `single, cycle, primary, white`.
 */
export function resolveBAnimatedToken(fullToken: string): { style: Properties; className: string } | undefined {
	const m = fullToken.match(/^b-animated\s*\(\s*([\s\S]*)\s*\)\s*$/i);
	if (!m) return undefined;
	const inner = m[1]!.trim();
	if (!inner) return undefined;

	const parts = inner
		.split(",")
		.map((p) => p.trim())
		.filter((p) => p.length > 0);
	if (!parts.length) return undefined;

	let mode: "edge" | "mesh" = "edge";
	const modeGuess = normalizeModeToken(parts[0]!);
	if (modeGuess != null) {
		mode = modeGuess;
		parts.shift();
		if (!parts.length) return undefined;
	}

	const kw = popKeywordSuffix(parts);
	const legacy = popLegacyNumericSuffix(parts);

	let powerRaw = kw.power ?? legacy.power ?? DEFAULT_POWER;
	let blurRaw = kw.blur ?? legacy.blur ?? DEFAULT_BLUR;
	let spreadPx = kw.spread ?? legacy.spread;

	if (!parts.length) return undefined;

	let useBgFill = false;
	if (isFillFromBgToken(parts[0]!)) {
		useBgFill = true;
		parts.shift();
		if (!parts.length) return undefined;
	}

	const idxCycle = parts.findIndex((p) => p.toLowerCase() === "cycle");
	let fillTok: string | undefined;
	let g1Tok: string | undefined;
	let g2Tok: string | undefined;
	let cyclePalette: string[] | undefined;

	if (mode === "mesh") {
		if (idxCycle >= 0) return undefined;
		if (useBgFill) {
			if (parts.length === 1) {
				g1Tok = parts[0]!;
			} else {
				g1Tok = parts[0]!;
				g2Tok = parts[1]!;
			}
			fillTok = undefined;
		} else if (parts.length === 1) {
			g1Tok = parts[0]!;
		} else if (parts.length === 2) {
			g1Tok = parts[0]!;
			g2Tok = parts[1]!;
			fillTok = undefined;
		} else {
			fillTok = parts[0]!;
			g1Tok = parts[1]!;
			g2Tok = parts[2]!;
		}
	} else if (idxCycle >= 0) {
		const before = parts.slice(0, idxCycle);
		cyclePalette = parts.slice(idxCycle + 1);
		if (cyclePalette.length < 2) return undefined;
		if (before.length > 1) return undefined;
		if (before.length === 1) fillTok = before[0]!;
	} else if (useBgFill) {
		if (parts.length >= 2) {
			cyclePalette = [...parts];
		} else if (parts.length === 1) {
			g1Tok = parts[0]!;
		}
	} else if (parts.length >= 3) {
		fillTok = parts[0]!;
		cyclePalette = parts.slice(1);
	} else if (parts.length === 2) {
		fillTok = parts[0]!;
		g1Tok = parts[1]!;
	} else {
		g1Tok = parts[0]!;
	}

	let fillCss: string | undefined;
	if (fillTok) {
		fillCss = resolveFillCss(fillTok);
		if (!fillCss) return undefined;
	}

	let g1Rgb: string;
	let g2Rgb: string;
	let slots: FiveSlots;
	let slotOpac: FiveOpac;

	if (cyclePalette) {
		const pal = fiveSlotsFromPalette(cyclePalette);
		if (!pal) return undefined;
		slots = pal.slots;
		slotOpac = pal.opac;
		g1Rgb = slots[0]!;
		g2Rgb = mode === "mesh" ? MESH_B_DEFAULT : g1Rgb;
	} else {
		const p1 = parseColorToken(g1Tok!) ?? { trip: B_ANIM_RGB.primary, alpha: 1 };
		g1Rgb = p1.trip;
		g2Rgb = g2Tok
			? parseColorToken(g2Tok)?.trip ?? g1Rgb
			: mode === "mesh"
				? MESH_B_DEFAULT
				: g1Rgb;
		const uni = fiveUniformSlots(p1.trip, p1.alpha);
		slots = uni.slots;
		slotOpac = uni.opac;
	}

	let durStr: string | undefined;
	if (kw.durSec != null) durStr = `${kw.durSec}s`;
	else if (kw.speed != null) {
		const base = mode === "mesh" ? BASE_MESH_DURATION_S : BASE_EDGE_DURATION_S;
		durStr = `${Math.min(120, Math.max(0.25, base / kw.speed))}s`;
	}

	const spreadMinAuto = Math.min(80, Math.max(14, Math.round(blurRaw * 0.65 + 16)));
	let spreadFinal: number;
	if (spreadPx != null && !Number.isNaN(spreadPx) && spreadPx > 0) {
		spreadFinal = Math.min(80, Math.max(2, spreadPx));
	} else {
		spreadFinal = Math.max(22, spreadMinAuto);
	}

	const style = {
		...(fillCss ? { ["--fw-ab-fill"]: fillCss } : {}),
		...(durStr ? { ["--fw-ab-duration"]: durStr } : {}),
		"--fw-ab-rgb": g1Rgb,
		"--fw-ab-c0": slots[0],
		"--fw-ab-c1": slots[1],
		"--fw-ab-c2": slots[2],
		"--fw-ab-c3": slots[3],
		"--fw-ab-c4": slots[4],
		"--fw-ab-o0": String(slotOpac[0]),
		"--fw-ab-o1": String(slotOpac[1]),
		"--fw-ab-o2": String(slotOpac[2]),
		"--fw-ab-o3": String(slotOpac[3]),
		"--fw-ab-o4": String(slotOpac[4]),
		"--fw-ab-mesh-rgb-a": g1Rgb,
		"--fw-ab-mesh-rgb-b": g2Rgb,
		"--fw-ab-power": powerFromBAnimatedArg(powerRaw),
		"--fw-ab-blur-mul": normalizeBlurMul(blurRaw),
		["--fw-ab-spread"]: `${spreadFinal}px`,
	} as Properties;

	const className = mode === "mesh" ? "fw-ab-mesh" : "fw-ab-edge";
	return { style, className };
}
