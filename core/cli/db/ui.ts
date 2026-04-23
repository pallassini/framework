/**
 * UI per il CLI `bun db` — estetica "modern CLI": box a cornice, una riga per
 * info, colonne allineate, wrap automatico per valori lunghi.
 *
 * Palette:
 *   grigio = noop / info secondario
 *   ciano  = header / accent
 *   verde  = success (PUSHED / OK)
 *   giallo = warning
 *   rosso  = error (FAILED)
 *
 * API:
 *   const ui = cli("DB PUSH");                    // titolo "bold" in cima
 *   ui.kv("time", "313 ms");                      // key/value allineato, con wrap
 *   ui.kv("url",  "https://...", "muted");
 *   ui.group("schemas", [["auth", "users, sessions"], ...]);
 *   ui.err("remoto ha rifiutato");
 *   ui.end("pushed");                             // bottom label verde
 *
 * Stati finali supportati da `end()`:
 *   "pushed"    → verde  "PUSHED"
 *   "pulled"    → verde  "PULLED"
 *   "ok"        → verde  "OK"
 *   "noop"      → grigio "ALREADY IN SYNC"
 *   "warning"   → giallo "DONE WITH WARNINGS"
 *   "error"     → rosso  "FAILED"
 */

const R = "\x1b[0m";
const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";

// true-color ANSI
const rgb = (r: number, g: number, b: number): string => `\x1b[38;2;${String(r)};${String(g)};${String(b)}m`;

const C = {
	dim: "\x1b[38;2;120;120;125m",
	fg: "\x1b[38;2;220;220;225m",
	cyan: rgb(94, 234, 212),
	green: rgb(74, 222, 128),
	yellow: rgb(253, 186, 116),
	red: rgb(248, 113, 113),
	violet: rgb(196, 181, 253),
	blue: rgb(125, 211, 252),
};

/** Bordo + accent (◆, titolo): default ciano, oppure verde / grigio / rosso per DB PUSH. */
export type CliFrame = "default" | "success" | "noop" | "error";

const FRAME_BORDER: Record<CliFrame, string> = {
	default: rgb(125, 211, 252),
	success: rgb(34, 197, 94),
	noop: rgb(113, 113, 122),
	error: rgb(239, 68, 68),
};

const FRAME_ACCENT: Record<CliFrame, string> = {
	default: C.cyan,
	success: C.green,
	noop: rgb(161, 161, 170),
	error: C.red,
};

const W = 72;
const PAD = 2;

const ANSI_RE = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g");
const strip = (s: string): string => s.replace(ANSI_RE, "");
const visLen = (s: string): number => strip(s).length;
const fill = (s: string, n: number): string => s + " ".repeat(Math.max(0, n - visLen(s)));

const boxRow = (border: string, content: string): string =>
	border + "│" + R + " ".repeat(PAD) + fill(content, W - PAD * 2) + " ".repeat(PAD) + border + "│" + R;

const boxBlank = (border: string): string =>
	border + "│" + R + " ".repeat(W) + border + "│" + R;

function drawTop(border: string, titleAnsi: string): string {
	const t = " " + titleAnsi + " ";
	const tw = visLen(t);
	const L = Math.floor((W - tw) / 2);
	const Rn = W - L - tw;
	return border + "╭" + "─".repeat(L) + R + t + border + "─".repeat(Rn) + "╮" + R;
}

function drawBottom(border: string, stateColor: string, stateLabel: string): string {
	const label = " " + stateColor + BOLD + stateLabel + R + " ";
	const lw = visLen(label);
	const L = Math.floor((W - lw) / 2);
	const Rn = W - L - lw;
	return border + "╰" + "─".repeat(L) + R + label + border + "─".repeat(Rn) + "╯" + R;
}

function sep(border: string): string {
	return border + "├" + "─".repeat(W) + "┤" + R;
}

export type StepTone = "info" | "ok" | "warn" | "err" | "muted";

export type EndTone =
	| "pushed"
	| "pulled"
	| "ok"
	| "success" // alias storico di "ok"
	| "noop"
	| "warning"
	| "error";

export type DbCli = {
	/** Riga libera dentro al box (no icona). */
	text(s: string, tone?: StepTone): void;
	/** Bullet step con icona neutra (◆). */
	step(s: string): void;
	/** Bullet step verde (✓). */
	ok(s: string): void;
	/** Bullet step giallo (!). */
	warn(s: string): void;
	/** Bullet step rosso (✖). */
	err(s: string): void;
	/** Bullet step grigio (·). */
	muted(s: string): void;
	/**
	 * Riga key/value allineata. Il valore va a capo se più lungo della colonna
	 * (mantenendo l'indentazione sotto la label).
	 */
	kv(key: string, value: string, tone?: StepTone): void;
	/** Alias storico di `kv` — mantenuto per compatibilità con i comandi esistenti. */
	line(key: string, value: string, tone?: StepTone): void;
	/**
	 * Sezione con titolo + sottoelenco allineato: stampa `◆ <title>` e sotto
	 * una riga per ciascuna coppia `[label, value]` indentata.
	 */
	group(title: string, rows: readonly (readonly [string, string])[]): void;
	/** Riga vuota (spaziatura interna al box). */
	blank(): void;
	/** Divisore orizzontale dentro al box. */
	divider(): void;
	/** Chiude il box con lo stato finale. */
	end(tone: EndTone, label?: string): void;
};

const GLYPH = {
	info: "◆",
	ok: "✓",
	warn: "!",
	err: "✖",
	muted: "·",
};

const TONE_COLOR: Record<StepTone, string> = {
	info: C.cyan,
	ok: C.green,
	warn: C.yellow,
	err: C.red,
	muted: C.dim,
};

function emit(line: string): void {
	process.stdout.write(line + "\n");
}

/** Larghezza utile dentro al box (esclusi bordi e padding). */
const INNER_W = W - PAD * 2;

/**
 * Spezza `s` in righe che stanno in `width` caratteri visibili, preferendo
 * separatori `, ` (per liste di tabelle) ma fallback su spazio/hard-break.
 */
function wrapValue(s: string, width: number): string[] {
	if (width <= 0 || visLen(s) <= width) return [s];
	const out: string[] = [];
	let rest = s;
	while (visLen(rest) > width) {
		let cut = -1;
		// Preferiamo spezzare su ", " il più a destra possibile entro `width`.
		for (let i = width; i > 0; i--) {
			if (rest[i] === "," && rest[i + 1] === " ") {
				cut = i + 1;
				break;
			}
		}
		if (cut === -1) {
			// Fallback: spazio
			for (let i = width; i > 0; i--) {
				if (rest[i] === " ") {
					cut = i;
					break;
				}
			}
		}
		if (cut === -1) cut = width; // hard-break
		out.push(rest.slice(0, cut).trimEnd());
		rest = rest.slice(cut).replace(/^\s+/, "");
	}
	if (rest.length > 0) out.push(rest);
	return out;
}

/**
 * Avvia un blocco UI.
 *
 *   1. `cli("pull", { alias: "prod", subtitle: "schema" })` → header `db · pull · …`, bordo ciano.
 *   2. `cli("DB PUSH", { frame: "noop" })` → titolo colorato come il tema (grigio / verde / rosso),
 *      bordo e ◆ allineati allo stesso tema; testo chiave/valore resta leggibile (fg/dim).
 */
export function cli(
	action: string,
	meta?: { alias?: string; subtitle?: string; frame?: CliFrame },
): DbCli {
	const frame: CliFrame = meta?.frame ?? "default";
	const border = FRAME_BORDER[frame];
	const accent = FRAME_ACCENT[frame];

	const legacyHeader =
		meta != null && (meta.alias != null || meta.subtitle != null);

	let titleAnsi: string;
	if (legacyHeader) {
		const parts: string[] = [
			`${BOLD}${C.cyan}db${R}`,
			`${C.dim}·${R} ${C.fg}${action}${R}`,
		];
		if (meta.alias) parts.push(`${C.dim}·${R} ${C.violet}${meta.alias}${R}`);
		if (meta.subtitle)
			parts.push(`${C.dim}·${R} ${C.dim}${meta.subtitle}${R}`);
		titleAnsi = parts.join(" ");
	} else {
		titleAnsi = `${BOLD}${accent}${action}${R}`;
	}

	emit("");
	emit(drawTop(border, titleAnsi));
	emit(boxBlank(border));

	const bullet = (tone: StepTone, msg: string): void => {
		const color = TONE_COLOR[tone];
		const glyph = GLYPH[tone];
		const msgColor = tone === "muted" ? C.dim : C.fg;
		const avail = INNER_W - 2;
		const lines = wrapValue(msg, avail);
		for (let i = 0; i < lines.length; i++) {
			const ln = lines[i]!;
			if (i === 0) {
				emit(boxRow(border, `${color}${glyph}${R} ${msgColor}${ln}${R}`));
			} else {
				emit(boxRow(border, `  ${msgColor}${ln}${R}`));
			}
		}
	};

	const KV_LABEL_W = 10;

	/** Valore: mai rosso solo perché il frame è error — resta leggibile. */
	const kvValColor = (tone: StepTone): string => {
		if (tone === "muted") return C.dim;
		if (tone === "ok") return C.green;
		if (tone === "warn") return C.yellow;
		if (tone === "err") return C.fg;
		return C.fg;
	};

	const kvRow = (key: string, value: string, tone: StepTone): void => {
		const valColor = kvValColor(tone);
		const padKey = key + " ".repeat(Math.max(0, KV_LABEL_W - visLen(key)));
		// `  ◆ ` + key(10) + `  ` → allineamento colonne valore
		const kvContPad = 2 + 1 + 1 + KV_LABEL_W + 2;
		const avail = INNER_W - kvContPad;
		const lines = wrapValue(value, Math.max(8, avail));
		const contPad = " ".repeat(kvContPad);
		for (let i = 0; i < lines.length; i++) {
			const ln = lines[i]!;
			if (i === 0) {
				emit(
					boxRow(
						border,
						`  ${accent}◆${R} ${C.dim}${padKey}${R}  ${valColor}${ln}${R}`,
					),
				);
			} else {
				emit(boxRow(border, `${contPad}${valColor}${ln}${R}`));
			}
		}
	};

	const GROUP_CHILD_INDENT = 6;

	return {
		text(s: string, tone: StepTone = "info"): void {
			const color = tone === "muted" ? C.dim : tone === "err" ? C.red : tone === "warn" ? C.yellow : C.fg;
			const lines = wrapValue(s, INNER_W - 2);
			for (const ln of lines) emit(boxRow(border, `  ${color}${ln}${R}`));
		},
		step(s: string): void {
			bullet("info", s);
		},
		ok(s: string): void {
			bullet("ok", s);
		},
		warn(s: string): void {
			bullet("warn", s);
		},
		err(s: string): void {
			const avail = INNER_W - 4;
			const lines = wrapValue(s, avail);
			for (let i = 0; i < lines.length; i++) {
				const ln = lines[i]!;
				if (i === 0) {
					emit(boxRow(border, `  ${C.red}✖${R} ${C.fg}${ln}${R}`));
				} else {
					emit(boxRow(border, `    ${C.fg}${ln}${R}`));
				}
			}
		},
		muted(s: string): void {
			bullet("muted", s);
		},
		kv(key: string, value: string, tone: StepTone = "info"): void {
			kvRow(key, value, tone);
		},
		line(key: string, value: string, tone: StepTone = "info"): void {
			kvRow(key, value, tone);
		},
		group(title: string, rows: readonly (readonly [string, string])[]): void {
			emit(boxRow(border, `  ${accent}◆${R} ${accent}${title}${R}`));
			if (rows.length === 0) return;
			const maxLabel = Math.min(
				18,
				Math.max(4, ...rows.map(([k]) => visLen(k))),
			);
			const grpContPad = GROUP_CHILD_INDENT + 1 + 1 + maxLabel + 2;
			for (const [k, v] of rows) {
				const padK = k + " ".repeat(Math.max(0, maxLabel - visLen(k)));
				const avail = INNER_W - grpContPad;
				const lines = wrapValue(v, Math.max(8, avail));
				const contPad = " ".repeat(grpContPad);
				for (let i = 0; i < lines.length; i++) {
					const ln = lines[i]!;
					if (i === 0) {
						emit(
							boxRow(
								border,
								`${" ".repeat(GROUP_CHILD_INDENT)}${accent}◆${R} ${C.dim}${padK}${R}  ${C.fg}${ln}${R}`,
							),
						);
					} else {
						emit(boxRow(border, `${contPad}${C.fg}${ln}${R}`));
					}
				}
			}
		},
		blank(): void {
			emit(boxBlank(border));
		},
		divider(): void {
			emit(sep(border));
		},
		end(tone: EndTone, label?: string): void {
			emit(boxBlank(border));
			const map = {
				pushed: { color: C.green, text: "PUSHED" },
				pulled: { color: C.green, text: "PULLED" },
				ok: { color: C.green, text: "OK" },
				success: { color: C.green, text: "OK" },
				noop: { color: FRAME_ACCENT.noop, text: "ALREADY IN SYNC" },
				warning: { color: C.yellow, text: "DONE WITH WARNINGS" },
				error: { color: C.red, text: "FAILED" },
			} as const;
			const m = map[tone];
			emit(drawBottom(border, m.color, label ?? m.text));
			emit("");
		},
	};
}

/** Render "inline" (no box), utile per help/usage. */
export function usage(title: string, rows: readonly { cmd: string; desc: string }[]): void {
	const cmdW = Math.max(...rows.map((r) => r.cmd.length));
	emit("");
	emit(`${BOLD}${C.cyan}db${R} ${C.dim}·${R} ${C.fg}${title}${R}`);
	emit("");
	for (const r of rows) {
		emit(`  ${C.violet}${fill(r.cmd, cmdW)}${R}  ${C.dim}${r.desc}${R}`);
	}
	emit("");
}

/** Formatta un numero di byte umano (KB/MB). */
export function humanBytes(n: number): string {
	if (n < 1024) return `${String(n)} B`;
	if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
	return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

/** Formatta ms in "123 ms" / "1.23 s". */
export function humanMs(ms: number): string {
	if (ms < 1000) return `${ms.toFixed(0)} ms`;
	return `${(ms / 1000).toFixed(2)} s`;
}

/** Piccolo helper per messaggi fuori dal box (es. errori fatali pre-box). */
export const colors = { ...C, bold: BOLD, dim: DIM, reset: R };
