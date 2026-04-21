/**
 * Preset + keyframes generati; CSS iniettato una volta. Prefisso `fw-`.
 */

import { ensureInjected } from "./inject";
import { CSS_LENGTH_RE, isCssVarToken, isSpacingKeyword } from "../properties/utils/units";
import { fwAnimateDebugLog } from "./debug-log";

/**
 * Stima ms per timer / catene quando la durata effettiva è `var(--duration)` da `client/index.css` `:root`.
 * Deve combaciare col valore di default di `--duration` lì definito.
 */
export const DEFAULT_DURATION_MS_ESTIMATE = 300;

const FW_DURATION_CSS = "var(--duration)" as const;

export type AnimationLayerDuration = number | typeof FW_DURATION_CSS;

function fmtAnimationDuration(d: AnimationLayerDuration): string {
	return d === FW_DURATION_CSS ? d : `${d}ms`;
}

function summarizeAnimateSegment(c: AnimatePreset | AnimateConfig): string {
	if (typeof c === "string") return `preset:${c}`;
	const o = c as AnimateConfig;
	const to = o.to != null ? String(o.to).slice(0, 100) : "";
	return JSON.stringify({
		to: to || undefined,
		duration: o.duration,
		delay: o.delay,
		ease: o.ease,
		preset: o.preset,
	});
}

export type AnimatePreset = string;

export type KeyframeStep = {
	opacity?: number;
	scale?: number;
	x?: number | string;
	y?: number | string;
	transform?: string;
	[key: string]: number | string | undefined;
};

/** Fermata lungo l’animazione (0–100% della `duration`). */
export type AnimateTrackStop = {
	/** Percentuale 0–100. */
	at: number;
	/** Token da sommare allo stato cumulativo (sovrascrive le stesse proprietà CSS di `base` / fermate precedenti). */
	to?: string;
	/** @deprecated Usa `to`. */
	s?: string;
	/** @deprecated Usa `to`. */
	style?: string;
};

export type AnimateConfig = {
	preset?: string;
	duration?: number;
	/** Ritardo in ms prima che parta **questo** segmento (si somma al `chainDelayMs` interno nelle catene `animate: [...]`). */
	delay?: number;
	ease?: string;
	fill?: "forwards" | "backwards" | "both" | "none";
	repeat?: number | "infinite";
	iterations?: number | "infinite";
	opacity?: [number, number];
	scale?: [number, number];
	scaleX?: [number, number];
	scaleY?: [number, number];
	x?: [number | string, number | string];
	y?: [number | string, number | string];
	rotate?: [number | string, number | string];
	blur?: [number, number];
	/**
	 * Più fermate nello stesso segmento: ogni `to` si **aggiunge** allo stato (merge per proprietà).
	 * Tupla `[at, "token…"]` = percentuale + `to`.
	 */
	track?: ReadonlyArray<AnimateTrackStop | readonly [number, string]>;
	/**
	 * Obiettivo al 100% del segmento. Lo 0% è sempre lo stato corrente (`base` + segmenti animati prima, o implicito).
	 * Ogni proprietà in `to` sovrascrive la stessa proprietà già presente.
	 */
	to?: string;
	/** Forma legacy: percentuali come chiavi; stringhe con merge cumulativo come `track`. */
	keyframes?: Record<string | number, KeyframeStep | string>;
	/** Chiamato quando parte il CSS animation di questo segmento (`animationstart`, dopo `delay`). */
	onStart?: () => void;
	/** Chiamato quando finisce il CSS animation di questo segmento (`animationend`; con `iterations` > 1 può ripetersi). */
	onEnd?: () => void;
};

/** Opzioni interne: risolve stringhe token → proprietà inline (da `resolveStyleString`). */
export type BuildAnimationOptions = {
	resolveTokens?: (tokenString: string) => Record<string, string>;
	/** Ritardo cumulativo prima di questo segmento quando `animate` è un array (catena sequenziale). */
	chainDelayMs?: number;
	/**
	 * Stile già risolto prima di questo segmento (`base` + `to` dei segmenti precedenti).
	 * Usato per 0% esplicito e per cumulare il `to` così le proprietà non si perdono tra un’animazione e l’altra.
	 */
	keyframeStartAcc?: Record<string, string>;
};

const PRESET_MOTION: Record<
	string,
	{ opacity?: [number, number]; scale?: [number, number]; x?: [number, number]; y?: [number, number] }
> = {
	"in-fade": { opacity: [0, 1] },
	"out-fade": { opacity: [1, 0] },
	"in-slide-up": { opacity: [0, 1], y: [8, 0] },
	"out-slide-up": { opacity: [1, 0], y: [0, -8] },
	"in-slide-down": { opacity: [0, 1], y: [-8, 0] },
	"out-slide-down": { opacity: [1, 0], y: [0, 8] },
	"in-slide-left": { opacity: [0, 1], x: [8, 0] },
	"out-slide-left": { opacity: [1, 0], x: [0, -8] },
	"in-slide-right": { opacity: [0, 1], x: [-8, 0] },
	"out-slide-right": { opacity: [1, 0], x: [0, 8] },
	"in-scale": { opacity: [0, 1], scale: [0.96, 1] },
	"out-scale": { opacity: [1, 0], scale: [1, 0.96] },
	"in-zoom": { opacity: [0, 1], scale: [0.9, 1] },
	"out-zoom": { opacity: [1, 0], scale: [1, 0.9] },
};

const BUNDLED_KEYFRAMES = `
@keyframes fw-fade-in{from{opacity:0}to{opacity:1}}
@keyframes fw-fade-out{from{opacity:1}to{opacity:0}}
@keyframes fw-slide-up-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
@keyframes fw-slide-up-out{from{opacity:1;transform:translateY(0)}to{opacity:0;transform:translateY(-8px)}}
@keyframes fw-slide-down-in{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}
@keyframes fw-slide-down-out{from{opacity:1;transform:translateY(0)}to{opacity:0;transform:translateY(8px)}}
@keyframes fw-slide-left-in{from{opacity:0;transform:translateX(8px)}to{opacity:1;transform:translateX(0)}}
@keyframes fw-slide-left-out{from{opacity:1;transform:translateX(0)}to{opacity:0;transform:translateX(-8px)}}
@keyframes fw-slide-right-in{from{opacity:0;transform:translateX(-8px)}to{opacity:1;transform:translateX(0)}}
@keyframes fw-slide-right-out{from{opacity:1;transform:translateX(0)}to{opacity:0;transform:translateX(8px)}}
@keyframes fw-scale-in{from{opacity:0;transform:scale(0.96)}to{opacity:1;transform:scale(1)}}
@keyframes fw-scale-out{from{opacity:1;transform:scale(1)}to{opacity:0;transform:scale(0.96)}}
@keyframes fw-zoom-in{from{opacity:0;transform:scale(0.9)}to{opacity:1;transform:scale(1)}}
@keyframes fw-zoom-out{from{opacity:1;transform:scale(1)}to{opacity:0;transform:scale(0.9)}}

.fw-in-fade{animation:fw-fade-in var(--duration) ease-out forwards}
.fw-out-fade{animation:fw-fade-out var(--duration) ease-in forwards}
.fw-in-slide-up{animation:fw-slide-up-in var(--duration) ease-out forwards}
.fw-out-slide-up{animation:fw-slide-up-out var(--duration) ease-in forwards}
.fw-in-slide-down{animation:fw-slide-down-in var(--duration) ease-out forwards}
.fw-out-slide-down{animation:fw-slide-down-out var(--duration) ease-in forwards}
.fw-in-slide-left{animation:fw-slide-left-in var(--duration) ease-out forwards}
.fw-out-slide-left{animation:fw-slide-left-out var(--duration) ease-in forwards}
.fw-in-slide-right{animation:fw-slide-right-in var(--duration) ease-out forwards}
.fw-out-slide-right{animation:fw-slide-right-out var(--duration) ease-in forwards}
.fw-in-scale{animation:fw-scale-in var(--duration) ease-out forwards}
.fw-out-scale{animation:fw-scale-out var(--duration) ease-in forwards}
.fw-in-zoom{animation:fw-zoom-in var(--duration) ease-out forwards}
.fw-out-zoom{animation:fw-zoom-out var(--duration) ease-in forwards}

.fw-dur-150{animation-duration:150ms}
.fw-dur-300{animation-duration:300ms}
.fw-dur-500{animation-duration:500ms}

@media(prefers-reduced-motion:reduce){.fw-in-fade,.fw-out-fade,.fw-in-slide-up,.fw-out-slide-up,.fw-in-slide-down,.fw-out-slide-down,.fw-in-slide-left,.fw-out-slide-left,.fw-in-slide-right,.fw-out-slide-right,.fw-in-scale,.fw-out-scale,.fw-in-zoom,.fw-out-zoom{animation-duration:1ms!important}}
`;

const ANIMATION_PRESETS: Record<string, { class: string }> = {
	"in-fade": { class: "fw-in-fade" },
	"out-fade": { class: "fw-out-fade" },
	"in-slide-up": { class: "fw-in-slide-up" },
	"out-slide-up": { class: "fw-out-slide-up" },
	"in-slide-down": { class: "fw-in-slide-down" },
	"out-slide-down": { class: "fw-out-slide-down" },
	"in-slide-left": { class: "fw-in-slide-left" },
	"out-slide-left": { class: "fw-out-slide-left" },
	"in-slide-right": { class: "fw-in-slide-right" },
	"out-slide-right": { class: "fw-out-slide-right" },
	"in-scale": { class: "fw-in-scale" },
	"out-scale": { class: "fw-out-scale" },
	"in-zoom": { class: "fw-in-zoom" },
	"out-zoom": { class: "fw-out-zoom" },
	"dur-150": { class: "fw-dur-150" },
	"dur-300": { class: "fw-dur-300" },
	"dur-500": { class: "fw-dur-500" },
};

export const ANIMATION_CSS = BUNDLED_KEYFRAMES;

/** Un segmento nella timeline (catena o singolo). */
export type AnimationTimelineLayer = {
	name: string;
	durationMs: AnimationLayerDuration;
	easing: string;
	delayMs: number;
	iteration: number | "infinite";
	fill: string;
	onStart?: () => void;
	onEnd?: () => void;
};

export type AnimationResult = {
	id?: string;
	class?: string;
	style?: Record<string, string>;
	keyframesCss?: string;
	/** Usato per ricostruire `style` in catena; con ≥2 layer si usano le longhand (più affidabile della shorthand con virgola). */
	layers?: AnimationTimelineLayer[];
};

const ANIMATION_STYLE_KEYS = new Set([
	"animation",
	"animationName",
	"animationDuration",
	"animationTimingFunction",
	"animationDelay",
	"animationIterationCount",
	"animationFillMode",
	"animationDirection",
	"animationPlayState",
]);

function stripAnimationStyleProps(s: Record<string, string> | undefined): Record<string, string> {
	if (!s) return {};
	const o: Record<string, string> = {};
	for (const [k, v] of Object.entries(s)) {
		if (ANIMATION_STYLE_KEYS.has(k)) continue;
		o[k] = v;
	}
	return o;
}

function layersToInlineStyle(layers: AnimationTimelineLayer[]): Record<string, string> {
	if (layers.length === 0) return {};
	if (layers.length === 1) {
		const L = layers[0]!;
		let a = `${L.name} ${fmtAnimationDuration(L.durationMs)} ${L.easing} ${L.delayMs}ms`;
		if (L.iteration !== 1) a += ` ${L.iteration === "infinite" ? "infinite" : L.iteration}`;
		a += ` ${L.fill}`;
		return { animation: a };
	}
	return {
		animationName: layers.map((l) => l.name).join(", "),
		animationDuration: layers.map((l) => fmtAnimationDuration(l.durationMs)).join(", "),
		animationTimingFunction: layers.map((l) => l.easing).join(", "),
		animationDelay: layers.map((l) => `${l.delayMs}ms`).join(", "),
		animationIterationCount: layers
			.map((l) => (l.iteration === "infinite" ? "infinite" : String(l.iteration)))
			.join(", "),
		animationFillMode: layers.map((l) => l.fill).join(", "),
	};
}

function mergeSequentialChain(acc: AnimationResult, step: AnimationResult): AnimationResult {
	const combinedLayers = [...(acc.layers ?? []), ...(step.layers ?? [])];
	const keyframesCss = [acc.keyframesCss, step.keyframesCss].filter(Boolean).join("\n");
	const cls = [acc.class, step.class].filter(Boolean).join(" ");

	const style: Record<string, string> = {};
	Object.assign(style, stripAnimationStyleProps(acc.style));
	Object.assign(style, stripAnimationStyleProps(step.style));

	if (combinedLayers.length) {
		Object.assign(style, layersToInlineStyle(combinedLayers));
	}

	return {
		id: step.id ?? acc.id,
		class: cls || undefined,
		style: Object.keys(style).length ? style : undefined,
		keyframesCss: keyframesCss || undefined,
		layers: combinedLayers.length ? combinedLayers : undefined,
	};
}

/** Durata “a schermo” di un segmento (delay locale + durata × ripetizioni). */
function estimateSegmentDurationMs(c: AnimatePreset | AnimateConfig): number {
	if (typeof c === "string") return DEFAULT_DURATION_MS_ESTIMATE;
	const cfg = c as AnimateConfig;
	const d = cfg.duration ?? DEFAULT_DURATION_MS_ESTIMATE;
	const delay = cfg.delay ?? 0;
	const iter = cfg.iterations ?? cfg.repeat ?? 1;
	if (iter === "infinite") return d + delay;
	const n = typeof iter === "number" && iter > 0 ? iter : 1;
	return (d + delay) * n;
}

function terminalAfterAnimateConfig(
	cfg: AnimateConfig,
	terminal: Record<string, string>,
	resolveTokens?: (s: string) => Record<string, string>,
): Record<string, string> {
	if (!resolveTokens) return terminal;
	const rows = collectTokenKeyframeRows(cfg);
	if (!rows?.length) return terminal;
	let acc = { ...terminal };
	const indexed = rows.map((r, i) => ({ ...r, i }));
	indexed.sort((a, b) => (a.at !== b.at ? a.at - b.at : a.i - b.i));
	const groups: Array<{ at: number; tos: string[] }> = [];
	for (const row of indexed) {
		const last = groups[groups.length - 1];
		if (last && last.at === row.at) last.tos.push(row.to);
		else groups.push({ at: row.at, tos: [row.to] });
	}
	for (const g of groups) {
		for (const toStr of g.tos) {
			acc = { ...acc, ...resolveTokens(toStr) };
		}
	}
	return acc;
}

function attachSegmentHooks(layer: AnimationTimelineLayer, cfg: AnimateConfig): void {
	if (cfg.onStart != null) layer.onStart = cfg.onStart;
	if (cfg.onEnd != null) layer.onEnd = cfg.onEnd;
}

function hasNoMotionTokens(cfg: AnimateConfig): boolean {
	return (
		(cfg.to == null || String(cfg.to).trim() === "") &&
		(cfg.track == null || cfg.track.length === 0) &&
		(cfg.keyframes == null || Object.keys(cfg.keyframes).length === 0) &&
		cfg.preset == null &&
		cfg.opacity == null &&
		cfg.scale == null &&
		cfg.scaleX == null &&
		cfg.scaleY == null &&
		cfg.x == null &&
		cfg.y == null &&
		cfg.rotate == null &&
		cfg.blur == null
	);
}

/** Keyframe senza dichiarazioni: layer no-op o hold (timeline CSS affidabile nelle catene). */
function createInvariantKeyframeSegment(
	effectiveDelayMs: number,
	durationMs: AnimationLayerDuration,
	ease: string,
	fill: string,
	iter: number | "infinite",
	cfg?: AnimateConfig,
): AnimationResult {
	const name = allocKeyframeName(`inv-${effectiveDelayMs}-${String(durationMs)}-${ease}-${String(iter)}`);
	const keyframesCss = `@keyframes ${name}{0%,100%{}}`;
	const layer: AnimationTimelineLayer = {
		name,
		durationMs: durationMs,
		easing: ease,
		delayMs: effectiveDelayMs,
		iteration: iter,
		fill,
	};
	if (cfg) attachSegmentHooks(layer, cfg);
	return {
		id: name,
		keyframesCss,
		layers: [layer],
		style: { ...layersToInlineStyle([layer]) },
	};
}

export function buildAnimation(
	config: AnimatePreset | AnimateConfig | Array<AnimatePreset | AnimateConfig>,
	opts?: BuildAnimationOptions,
): AnimationResult {
	if (Array.isArray(config)) {
		if (config.length === 0) return {};
		const { keyframeStartAcc: chainSeed = {}, chainDelayMs: _ignore, ...restOpts } = opts ?? {};
		fwAnimateDebugLog("chain start", {
			userSegments: config.length,
			keyframeStartAccKeys: Object.keys(chainSeed),
			keyframeStartAccSample: Object.fromEntries(Object.entries(chainSeed).slice(0, 8)),
		});
		let chainDelayMs = 0;
		let terminal: Record<string, string> = { ...chainSeed };
		let acc: AnimationResult = {};
		config.forEach((c, i) => {
			const chainDelayMsBefore = chainDelayMs;
			const r = buildAnimation(c, {
				...restOpts,
				chainDelayMs,
				keyframeStartAcc: terminal,
			});
			acc = mergeSequentialChain(acc, r);
			if (typeof c === "object" && c !== null && !Array.isArray(c)) {
				terminal = terminalAfterAnimateConfig(c as AnimateConfig, terminal, restOpts.resolveTokens);
			}
			const est = estimateSegmentDurationMs(c);
			chainDelayMs += est;
			fwAnimateDebugLog(`chain segment ${i}`, summarizeAnimateSegment(c), {
				chainDelayMsBefore,
				estimateSegmentMs: est,
				chainDelayMsAfter: chainDelayMs,
				stepLayers: r.layers?.length ?? 0,
				stepId: r.id,
				stepClass: r.class,
				stepHasKeyframesCss: Boolean(r.keyframesCss),
				accLayersAfterMerge: acc.layers?.length ?? 0,
				terminalKeys: Object.keys(terminal).slice(0, 12),
			});
		});
		const layersBeforeSynth = acc.layers?.length ?? 0;
		/**
		 * Con 2 sole animazioni in lista (`animationName` con due voci) alcuni motori applicano male la catena.
		 * Aggiungiamo **dopo** la sequenza utente uno o più layer `@keyframes` vuoti (durata 0), con `animation-delay`
		 * incrementale (+0ms, +1ms, …) così non sono tutti sovrapposti sullo stesso istante.
		 */
		let padStagger = 0;
		let synthCount = 0;
		while ((acc.layers?.length ?? 0) > 0 && (acc.layers?.length ?? 0) < 3) {
			const delayMs = chainDelayMs + padStagger;
			fwAnimateDebugLog("chain synth pad", {
				index: synthCount,
				animationDelayMs: delayMs,
				layersBefore: acc.layers?.length ?? 0,
			});
			acc = mergeSequentialChain(
				acc,
				createInvariantKeyframeSegment(delayMs, 0, "linear", "forwards", 1),
			);
			padStagger += 1;
			synthCount += 1;
		}
		fwAnimateDebugLog("chain done", {
			layersBeforeSynth,
			synthPadsAdded: synthCount,
			finalLayers: acc.layers?.length ?? 0,
			finalStyleKeys: acc.style ? Object.keys(acc.style) : [],
			animationShorthand: acc.style?.animation,
			animationName: acc.style?.animationName,
			animationDuration: acc.style?.animationDuration,
			animationDelay: acc.style?.animationDelay,
			keyframesCssLength: acc.keyframesCss?.length ?? 0,
		});
		return acc;
	}

	if (typeof config === "string") {
		const preset = ANIMATION_PRESETS[config];
		if (!preset) return {};
		return { class: preset.class };
	}

	let cfg = { ...config } as AnimateConfig;
	if (Object.keys(cfg).length === 0) {
		cfg = { preset: "in-fade" };
	}

	return createCustomAnimation(cfg, opts);
}

const EASE: Record<string, string> = {
	ease: "ease",
	in: "ease-in",
	out: "ease-out",
	inout: "ease-in-out",
	linear: "linear",
};

const SKIP_PROPS_IN_KEYFRAMES = new Set([
	"animation",
	"animationDelay",
	"animationDirection",
	"animationDuration",
	"animationFillMode",
	"animationIterationCount",
	"animationName",
	"animationPlayState",
	"animationTimingFunction",
	"animationRange",
	"animationTimeline",
	"willChange",
	"transition",
]);

function recordToKeyframeDeclarations(record: Record<string, string>): string {
	const parts: string[] = [];
	for (const [k, v] of Object.entries(record)) {
		if (v == null || v === "" || SKIP_PROPS_IN_KEYFRAMES.has(k)) continue;
		const kebab = k.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase());
		parts.push(`${kebab}:${v}`);
	}
	return parts.join(";");
}

function clampPct(n: number): number {
	if (!Number.isFinite(n)) return 0;
	return Math.max(0, Math.min(100, n));
}

function stopToString(item: AnimateTrackStop | readonly [number, string]): { at: number; to: string } | null {
	if (Array.isArray(item)) {
		const at = clampPct(Number(item[0]));
		const to = String(item[1] ?? "").trim();
		return to ? { at, to } : null;
	}
	const to = (item.to ?? item.s ?? item.style ?? "").trim();
	return to ? { at: clampPct(item.at), to } : null;
}

/** Righe `at`+`to` da `track` oppure un solo `to` al 100%. */
function collectTokenKeyframeRows(cfg: AnimateConfig): Array<{ at: number; to: string }> | null {
	if (cfg.track != null && cfg.track.length > 0) {
		const out: Array<{ at: number; to: string }> = [];
		for (const item of cfg.track) {
			const row = stopToString(item);
			if (row) out.push(row);
		}
		return out.length ? out : null;
	}
	if (cfg.to != null) {
		const to = String(cfg.to).trim();
		if (to) return [{ at: 100, to }];
	}
	return null;
}

/**
 * Stato cumulativo: ogni gruppo (stesso `at`, più `to` in ordine) fa merge sul record;
 * tra gruppi con `at` diversi il merge continua così ogni keyframe contiene tutto lo stato fino a quel punto.
 */
function buildCumulativeKeyframeEntries(
	rows: Array<{ at: number; to: string }>,
	opts: BuildAnimationOptions | undefined,
	startAcc: Record<string, string>,
): [string, string][] {
	const indexed = rows.map((r, i) => ({ ...r, i }));
	indexed.sort((a, b) => (a.at !== b.at ? a.at - b.at : a.i - b.i));

	const groups: Array<{ at: number; tos: string[] }> = [];
	for (const row of indexed) {
		const last = groups[groups.length - 1];
		if (last && last.at === row.at) last.tos.push(row.to);
		else groups.push({ at: row.at, tos: [row.to] });
	}

	let acc: Record<string, string> = opts?.resolveTokens ? { ...startAcc } : {};
	let tokenAcc = "";
	const entries: [string, string][] = [];

	for (const g of groups) {
		let decl = "";
		if (opts?.resolveTokens) {
			for (const toStr of g.tos) {
				acc = { ...acc, ...opts.resolveTokens(toStr) };
			}
			decl = recordToKeyframeDeclarations(acc);
		} else {
			tokenAcc = [tokenAcc, ...g.tos].filter(Boolean).join(" ").trim();
			decl = stringStepToCss(tokenAcc, opts);
		}
		if (decl) entries.push([`${g.at}%`, decl]);
	}

	const zeroDecl = recordToKeyframeDeclarations(startAcc);
	const hasZero = entries.some(([p]) => p === "0%");
	if (zeroDecl && !hasZero && entries.length > 0) {
		entries.unshift(["0%", zeroDecl]);
	}
	return entries;
}

function pctLabelToNumber(pct: string): number {
	if (pct === "0%") return 0;
	if (pct === "100%") return 100;
	const n = parseInt(pct.replace("%", ""), 10);
	return Number.isFinite(n) ? clampPct(n) : 0;
}

function stringStepToCss(step: string, opts?: BuildAnimationOptions): string {
	const t = step.trim();
	if (!t) return "";
	if (opts?.resolveTokens) {
		const rec = opts.resolveTokens(t);
		const fromMap = recordToKeyframeDeclarations(rec);
		if (fromMap) return fromMap;
	}
	return stepToCss(parseKeyframeStepString(t)).join(";");
}

function declarationsMightNeedTransformOrigin(css: string): boolean {
	return /\btransform\s*:/.test(css) && /scale\s*\(/i.test(css);
}

function hash(s: string): string {
	let h = 0;
	for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
	return "k" + Math.abs(h).toString(36);
}

/** Evita collisioni sul nome @keyframes (insertRule fallisce in silenzio se il nome è duplicato). */
let fwKeyframeNameSeq = 0;

function allocKeyframeName(salt: string): string {
	return `fw-kf-${++fwKeyframeNameSeq}-${hash(salt)}`;
}

function px(v: number | string): string {
	return typeof v === "number" ? `${v}px` : String(v);
}

const TRANSFORM_KEYS = new Set(["scale", "x", "y", "transform"]);

function stepToCss(step: KeyframeStep): string[] {
	const out: string[] = [];
	const transformParts: string[] = [];

	for (const [k, v] of Object.entries(step)) {
		if (v === undefined) continue;
		if (k === "opacity") {
			out.push(`opacity:${v}`);
		} else if (k === "scale") {
			transformParts.push(`scale(${v})`);
		} else if (k === "x") {
			transformParts.push(`translateX(${px(v as number | string)})`);
		} else if (k === "y") {
			transformParts.push(`translateY(${px(v as number | string)})`);
		} else if (k === "transform") {
			transformParts.push(String(v));
		} else if (!TRANSFORM_KEYS.has(k)) {
			const cssKey =
				k === "bg"
					? "background"
					: k === "c"
						? "color"
						: k.replace(/([A-Z])/g, "-$1").toLowerCase().replace(/^-/, "");
			out.push(`${cssKey}:${v}`);
		}
	}
	if (transformParts.length) {
		const hasScale = transformParts.some((p) => p.startsWith("scale("));
		if (hasScale) {
			transformParts.unshift("translateZ(0)");
			out.push("transform-origin:50% 50%");
		}
		out.push(`transform:${transformParts.join(" ")}`);
	}
	return out;
}

const KEYFRAME_COLORS = new Set(["red", "white", "black", "blue", "green", "gray", "grey", "transparent"]);

function isValidSpacingCssSuffix(s: string): boolean {
	return isSpacingKeyword(s) || CSS_LENGTH_RE.test(s) || isCssVarToken(s) || /^base-\d+$/.test(s);
}

/** Margini tipo token `s` (`mt-50vh`, `mb-0`) → proprietà camelCase per `stepToCss`. */
const KEYFRAME_MARGIN_EDGE: Record<string, string> = {
	mt: "marginTop",
	mb: "marginBottom",
	ml: "marginLeft",
	mr: "marginRight",
};

function parseKeyframeStepString(str: string): KeyframeStep {
	const step: KeyframeStep = {};
	const tokens = str.trim().split(/\s+/).filter(Boolean);
	const hexRe = /^([a-z]+)-#([a-fA-F0-9]{3,8})$/;
	const colorRe = /^(bg|c|color)-([a-zA-Z][a-zA-Z0-9-]*)$/;
	const numRe = /^([a-z]+)-([\d.]+)$/;
	const marginEdgeRe = /^(mt|mb|ml|mr)-(.+)$/;
	const marginAllRe = /^m-(.+)$/;
	for (const t of tokens) {
		const hex = t.match(hexRe);
		if (hex) {
			const [, key, hexVal] = hex;
			const val =
				hexVal!.length === 3
					? `#${hexVal![0]}${hexVal![0]}${hexVal![1]}${hexVal![1]}${hexVal![2]}${hexVal![2]}`
					: `#${hexVal}`;
			if (key === "bg") step.bg = val;
			else if (key === "c" || key === "color") step.c = val;
			else (step as Record<string, string>)[key ?? ""] = val;
			continue;
		}
		const color = t.match(colorRe);
		if (color && !t.includes("#")) {
			const [, key, val] = color;
			const cssVal = KEYFRAME_COLORS.has(val!) ? val! : `var(--${val})`;
			if (key === "bg") step.bg = cssVal;
			else step.c = cssVal;
			continue;
		}
		const marginEdge = t.match(marginEdgeRe);
		if (marginEdge) {
			const [, edge, suffix] = marginEdge;
			if (suffix && isValidSpacingCssSuffix(suffix)) {
				const prop = KEYFRAME_MARGIN_EDGE[edge!]!;
				(step as Record<string, string>)[prop] = suffix;
				continue;
			}
		}
		const marginAll = t.match(marginAllRe);
		if (marginAll) {
			const suffix = marginAll[1];
			if (suffix && isValidSpacingCssSuffix(suffix)) {
				(step as Record<string, string>).margin = suffix;
				continue;
			}
		}
		const num = t.match(numRe);
		if (num) {
			const [, key, val] = num;
			const n = parseFloat(val ?? "0");
			if (key === "opacity") step.opacity = n;
			else if (key === "scale") step.scale = n;
			else if (key === "x" || key === "y") (step as Record<string, number>)[key] = n;
		}
	}
	return step;
}

function percentKey(k: string | number): string {
	if (k === "from") return "0%";
	if (k === "to") return "100%";
	const n = typeof k === "number" ? k : parseInt(String(k), 10);
	if (!Number.isNaN(n) && n >= 0 && n <= 100) return `${n}%`;
	return `${k}%`;
}

function blurToFilter(blur: [number, number]): { from: string; to: string } {
	return {
		from: `filter:blur(${blur[0]}px)`,
		to: `filter:blur(${blur[1]}px)`,
	};
}

function cssValRotate(v: number | string): string {
	return typeof v === "number" ? `${v}deg` : String(v);
}

function finalizeKeyframeEntries(
	entries: [string, string][],
	cfg: AnimateConfig,
	d: AnimationLayerDuration,
	ease: string,
	iter: number | "infinite",
	effectiveDelayMs: number,
	fill: string,
): AnimationResult {
	const blocks = entries.map(([pct, css]) => `${pct}{${css}}`).join("");
	const name = allocKeyframeName(JSON.stringify(entries) + String(d) + ease + String(effectiveDelayMs));
	const keyframesCss = `@keyframes ${name}{${blocks}}`;
	const layer: AnimationTimelineLayer = {
		name,
		durationMs: d,
		easing: ease,
		delayMs: effectiveDelayMs,
		iteration: iter,
		fill,
	};
	attachSegmentHooks(layer, cfg);

	const hasScaleObject =
		cfg.keyframes &&
		Object.values(cfg.keyframes).some((s) => s && typeof s === "object" && "scale" in s);
	const hasScaleCss = entries.some(([, css]) => declarationsMightNeedTransformOrigin(css));
	const hasScale = Boolean(hasScaleObject) || hasScaleCss;

	const style: Record<string, string> = { ...layersToInlineStyle([layer]) };
	if (hasScale) {
		style.transformOrigin = "50% 50%";
		style.willChange = "transform";
	}
	return { id: name, keyframesCss, layers: [layer], style };
}

function createCustomAnimation(cfg: AnimateConfig, opts?: BuildAnimationOptions): AnimationResult {
	const layerDuration: AnimationLayerDuration =
		cfg.duration != null ? cfg.duration : FW_DURATION_CSS;
	const ease = EASE[cfg.ease ?? ""] ?? cfg.ease ?? "ease-out";
	const iter = cfg.iterations ?? cfg.repeat ?? 1;
	const delayMs = cfg.delay ?? 0;
	const effectiveDelayMs = delayMs + (opts?.chainDelayMs ?? 0);
	const fill = cfg.fill ?? "forwards";

	fwAnimateDebugLog("createCustom enter", {
		d: layerDuration,
		ease,
		iter,
		delayMs,
		chainDelayMs: opts?.chainDelayMs ?? 0,
		effectiveDelayMs,
		to: cfg.to != null ? String(cfg.to).slice(0, 80) : "",
		hasNoMotion: hasNoMotionTokens(cfg),
		keyframeAccKeys: opts?.keyframeStartAcc ? Object.keys(opts.keyframeStartAcc).slice(0, 10) : [],
	});

	if (typeof layerDuration === "number" && layerDuration === 0 && hasNoMotionTokens(cfg)) {
		fwAnimateDebugLog("createCustom -> noop duration 0 (invariant keyframes)");
		return createInvariantKeyframeSegment(effectiveDelayMs, 0, ease, fill, iter, cfg);
	}

	const tokenRows = collectTokenKeyframeRows(cfg);
	if (tokenRows && tokenRows.length > 0) {
		const entries = buildCumulativeKeyframeEntries(tokenRows, opts, opts?.keyframeStartAcc ?? {});
		if (entries.length >= 1) {
			fwAnimateDebugLog("createCustom -> token/to keyframes", { rows: tokenRows.length, entries: entries.length });
			return finalizeKeyframeEntries(entries, cfg, layerDuration, ease, iter, effectiveDelayMs, fill);
		}
		fwAnimateDebugLog("createCustom -> token rows but no entries (unexpected)", { tokenRows: tokenRows.length });
	}

	if (cfg.keyframes && Object.keys(cfg.keyframes).length > 0) {
		const pairs = Object.entries(cfg.keyframes).filter(([, step]) => step != null);
		const allStrings = pairs.every(([, step]) => typeof step === "string");
		if (allStrings) {
			const rows: Array<{ at: number; to: string }> = [];
			for (const [k, step] of pairs) {
				const to = String(step).trim();
				if (to) rows.push({ at: pctLabelToNumber(percentKey(k)), to });
			}
			const entries = buildCumulativeKeyframeEntries(rows, opts, opts?.keyframeStartAcc ?? {});
			if (entries.length >= 1) {
				return finalizeKeyframeEntries(entries, cfg, layerDuration, ease, iter, effectiveDelayMs, fill);
			}
		} else {
			const entries = pairs
				.map(([k, step]) => {
					const css =
						typeof step === "string"
							? stringStepToCss(step, opts)
							: stepToCss(step as KeyframeStep).join(";");
					return [percentKey(k), css] as [string, string];
				})
				.filter(([, css]) => css)
				.sort((a, b) => {
					const pct = (x: string) =>
						x === "0%" ? 0 : x === "100%" ? 100 : parseInt(x.replace("%", ""), 10);
					return pct(a[0]) - pct(b[0]);
				});
			if (entries.length >= 1) {
				return finalizeKeyframeEntries(entries, cfg, layerDuration, ease, iter, effectiveDelayMs, fill);
			}
		}
	}

	let opacity: [number, number] | undefined;
	let scale: [number, number] | undefined;
	let x: [number | string, number | string] | undefined;
	let y: [number | string, number | string] | undefined;

	if (cfg.preset && PRESET_MOTION[cfg.preset]) {
		const p = PRESET_MOTION[cfg.preset]!;
		opacity = cfg.opacity ?? p.opacity;
		scale = cfg.scale ?? p.scale;
		x = cfg.x ?? (p.x as [number | string, number | string]);
		y = cfg.y ?? (p.y as [number | string, number | string]);
	} else {
		opacity = cfg.opacity;
		scale = cfg.scale;
		x = cfg.x;
		y = cfg.y;
	}

	const from: string[] = [];
	const to: string[] = [];

	if (opacity) {
		from.push(`opacity:${opacity[0]}`);
		to.push(`opacity:${opacity[1]}`);
	}

	const tf = (): string => {
		const p: string[] = [];
		if (scale) p.push(`scale(${scale[0]})`);
		else if (cfg.scaleX != null || cfg.scaleY != null) {
			p.push(`scale(${cfg.scaleX?.[0] ?? 1}, ${cfg.scaleY?.[0] ?? 1})`);
		}
		if (x) p.push(`translateX(${px(x[0])})`);
		if (y) p.push(`translateY(${px(y[0])})`);
		if (cfg.rotate) p.push(`rotate(${cssValRotate(cfg.rotate[0])})`);
		return p.length ? p.join(" ") : "none";
	};
	const tt = (): string => {
		const p: string[] = [];
		if (scale) p.push(`scale(${scale[1]})`);
		else if (cfg.scaleX != null || cfg.scaleY != null) {
			p.push(`scale(${cfg.scaleX?.[1] ?? 1}, ${cfg.scaleY?.[1] ?? 1})`);
		}
		if (x) p.push(`translateX(${px(x[1])})`);
		if (y) p.push(`translateY(${px(y[1])})`);
		if (cfg.rotate) p.push(`rotate(${cssValRotate(cfg.rotate[1])})`);
		return p.length ? p.join(" ") : "none";
	};

	const tFrom = tf();
	const tTo = tt();
	if (tFrom !== "none") {
		if (scale) {
			from.push("transform-origin:50% 50%");
			to.push("transform-origin:50% 50%");
		}
		from.push(`transform:${tFrom}`);
		to.push(`transform:${tTo}`);
	}

	if (cfg.blur) {
		const { from: bf, to: bt } = blurToFilter(cfg.blur);
		from.push(bf);
		to.push(bt);
	}

	if (from.length === 0 && to.length === 0) {
		const presetOnly = cfg.preset && ANIMATION_PRESETS[cfg.preset];
		if (presetOnly) {
			fwAnimateDebugLog("createCustom -> preset class only", cfg.preset);
			return { class: presetOnly.class };
		}
		if (
			hasNoMotionTokens(cfg) &&
			(typeof layerDuration === "number" ? layerDuration > 0 : true)
		) {
			fwAnimateDebugLog("createCustom -> hold (empty to, d>0)", {
				d: layerDuration,
				effectiveDelayMs,
			});
			return createInvariantKeyframeSegment(effectiveDelayMs, layerDuration, ease, fill, iter, cfg);
		}
		fwAnimateDebugLog("createCustom -> EMPTY {} (no keyframes, check config)", {
			d: layerDuration,
			preset: cfg.preset,
			hasNoMotion: hasNoMotionTokens(cfg),
		});
		return {};
	}

	const name = allocKeyframeName(
		JSON.stringify({ d: layerDuration, ease, from, to, effectiveDelayMs }),
	);
	const css = `@keyframes ${name}{from{${from.join(";")}}to{${to.join(";")}}}`;
	const layer: AnimationTimelineLayer = {
		name,
		durationMs: layerDuration,
		easing: ease,
		delayMs: effectiveDelayMs,
		iteration: iter,
		fill,
	};
	attachSegmentHooks(layer, cfg);

	const style: Record<string, string> = { ...layersToInlineStyle([layer]) };
	if (scale || cfg.scaleX != null || cfg.scaleY != null) {
		style.transformOrigin = "50% 50%";
		style.willChange = "transform";
	}

	return { id: name, keyframesCss: css, layers: [layer], style };
}

export function ensureAnimationCss(): void {
	ensureInjected("fw-animations", ANIMATION_CSS);
}
