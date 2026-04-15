/**
 * Preset + keyframes generati; CSS iniettato una volta. Prefisso `fw-`.
 */

import { ensureInjected } from "./inject";

export type AnimatePreset = string;

export type KeyframeStep = {
	opacity?: number;
	scale?: number;
	x?: number | string;
	y?: number | string;
	transform?: string;
	[key: string]: number | string | undefined;
};

export type AnimateConfig = {
	preset?: string;
	duration?: number;
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
	keyframes?: Record<string | number, KeyframeStep | string>;
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

.fw-in-fade{animation:fw-fade-in 200ms ease-out forwards}
.fw-out-fade{animation:fw-fade-out 200ms ease-in forwards}
.fw-in-slide-up{animation:fw-slide-up-in 200ms ease-out forwards}
.fw-out-slide-up{animation:fw-slide-up-out 200ms ease-in forwards}
.fw-in-slide-down{animation:fw-slide-down-in 200ms ease-out forwards}
.fw-out-slide-down{animation:fw-slide-down-out 200ms ease-in forwards}
.fw-in-slide-left{animation:fw-slide-left-in 200ms ease-out forwards}
.fw-out-slide-left{animation:fw-slide-left-out 200ms ease-in forwards}
.fw-in-slide-right{animation:fw-slide-right-in 200ms ease-out forwards}
.fw-out-slide-right{animation:fw-slide-right-out 200ms ease-in forwards}
.fw-in-scale{animation:fw-scale-in 200ms ease-out forwards}
.fw-out-scale{animation:fw-scale-out 200ms ease-in forwards}
.fw-in-zoom{animation:fw-zoom-in 200ms ease-out forwards}
.fw-out-zoom{animation:fw-zoom-out 200ms ease-in forwards}

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

export type AnimationResult = {
	id?: string;
	class?: string;
	style?: Record<string, string>;
	keyframesCss?: string;
};

export function buildAnimation(
	config: AnimatePreset | AnimateConfig | Array<AnimatePreset | AnimateConfig>,
): AnimationResult {
	if (Array.isArray(config)) {
		return config.reduce<AnimationResult>((acc, c) => {
			const r = buildAnimation(c);
			return {
				...acc,
				...r,
				class: [acc.class, r.class].filter(Boolean).join(" "),
				style: { ...acc.style, ...r.style },
			};
		}, {});
	}

	if (typeof config === "string") {
		const preset = ANIMATION_PRESETS[config];
		if (!preset) return {};
		return { class: preset.class };
	}

	let cfg = { ...config } as AnimateConfig;
	if (Object.keys(cfg).length === 0) {
		cfg = { preset: "in-fade", duration: 200 };
	}

	return createCustomAnimation(cfg);
}

const EASE: Record<string, string> = {
	ease: "ease",
	in: "ease-in",
	out: "ease-out",
	inout: "ease-in-out",
	linear: "linear",
};

function hash(s: string): string {
	let h = 0;
	for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
	return "k" + Math.abs(h).toString(36);
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

function parseKeyframeStepString(str: string): KeyframeStep {
	const step: KeyframeStep = {};
	const tokens = str.trim().split(/\s+/).filter(Boolean);
	const hexRe = /^([a-z]+)-#([a-fA-F0-9]{3,8})$/;
	const colorRe = /^(bg|c|color)-([a-zA-Z][a-zA-Z0-9-]*)$/;
	const numRe = /^([a-z]+)-([\d.]+)$/;
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

function createCustomAnimation(cfg: AnimateConfig): AnimationResult {
	const d = cfg.duration ?? 200;
	const ease = EASE[cfg.ease ?? ""] ?? cfg.ease ?? "ease-out";
	const iter = cfg.iterations ?? cfg.repeat ?? 1;
	const delayMs = cfg.delay ?? 0;
	const fill = cfg.fill ?? "forwards";

	if (cfg.keyframes && Object.keys(cfg.keyframes).length > 0) {
		const entries = Object.entries(cfg.keyframes)
			.map(([k, step]) => {
				const parsed = typeof step === "string" ? parseKeyframeStepString(step) : (step as KeyframeStep);
				return [percentKey(k), stepToCss(parsed).join(";")] as [string, string];
			})
			.filter(([, css]) => css)
			.sort((a, b) => {
				const pct = (x: string) =>
					x === "0%" ? 0 : x === "100%" ? 100 : parseInt(x.replace("%", ""), 10);
				return pct(a[0]) - pct(b[0]);
			});
		const blocks = entries.map(([pct, css]) => `${pct}{${css}}`).join("");
		const id = hash(JSON.stringify(cfg.keyframes) + String(d) + ease);
		const name = `fw-kf-${id}`;
		const css = `@keyframes ${name}{${blocks}}`;
		let animation = `${name} ${d}ms ${ease}`;
		if (delayMs) animation += ` ${delayMs}ms`;
		if (iter !== 1) animation += ` ${iter === "infinite" ? "infinite" : iter}`;
		animation += ` ${fill}`;

		const hasScale =
			cfg.keyframes &&
			Object.values(cfg.keyframes).some((s) => s && typeof s === "object" && "scale" in s);
		const style: Record<string, string> = { animation };
		if (hasScale) {
			style.transformOrigin = "50% 50%";
			style.willChange = "transform";
		}
		return { id, keyframesCss: css, style };
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
		if (presetOnly) return { class: presetOnly.class };
		return {};
	}

	const id = hash(JSON.stringify({ d, ease, from, to }));
	const name = `fw-kf-${id}`;
	const css = `@keyframes ${name}{from{${from.join(";")}}to{${to.join(";")}}}`;
	let animation = `${name} ${d}ms ${ease}`;
	if (delayMs) animation += ` ${delayMs}ms`;
	if (iter !== 1) animation += ` ${iter === "infinite" ? "infinite" : iter}`;
	animation += ` ${fill}`;

	const style: Record<string, string> = { animation };
	if (scale || cfg.scaleX != null || cfg.scaleY != null) {
		style.transformOrigin = "50% 50%";
		style.willChange = "transform";
	}

	return { id, keyframesCss: css, style };
}

export function ensureAnimationCss(): void {
	ensureInjected("fw-animations", ANIMATION_CSS);
}
