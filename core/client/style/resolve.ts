import type { Properties } from "csstype";
import type { StyleGroup, StyleResolver, StyleResolverContext } from "./properties";
import { FW_BACKDROP_PARTS } from "./fw-backdrop-parts-symbol";
import { tokenizeStyleString } from "./tokenize-style";

/** `-mt-11vh` → base `mt`, suffix `11vh`, `negative: true` (come prefisso `-` su utility Tailwind-style). */
export function parseStyleToken(token: string): { base: string; suffix: string; negative?: boolean } {
	let negative = false;
	let rest = token;
	if (rest.startsWith("-") && rest.length > 1) {
		negative = true;
		rest = rest.slice(1);
	}
	const i = rest.indexOf("-");
	if (i === -1) return { base: rest, suffix: "", ...(negative ? { negative: true } : {}) };
	return { base: rest.slice(0, i), suffix: rest.slice(i + 1), ...(negative ? { negative: true } : {}) };
}

/**
 * - Senza `,`: tutte le parole (spazi) devono essere presenti — es. `"m flex"`.
 * - Con `,`: basta **un** gruppo — ogni gruppo è `trim`; se contiene spazi, tutte
 *   le parole di quel gruppo devono esserci — es. `"absolute,fixed"` oppure `"m flex, m tight"`.
 */
function variantKeyMatches(pattern: string, bases: ReadonlySet<string>): boolean {
	const trimmed = pattern.trim();
	if (!trimmed) return false;

	if (trimmed.includes(",")) {
		return trimmed
			.split(",")
			.map((g) => g.trim())
			.filter(Boolean)
			.some((group) => {
				const parts = group.split(/\s+/).filter(Boolean);
				return parts.length > 0 && parts.every((p) => bases.has(p));
			});
	}

	const parts = trimmed.split(/\s+/).filter(Boolean);
	return parts.length > 0 && parts.every((p) => bases.has(p));
}

function isStyleGroup(x: unknown): x is StyleGroup {
	if (typeof x !== "object" || x === null || !("default" in x)) return false;
	const d = (x as StyleGroup).default;
	return typeof d === "function" || (typeof d === "object" && d !== null);
}

/**
 * Con `row`/`col` + `center`/`centerx`/`centery`, la variante posizionata aggiungebbe `left`+`transform`
 * e romperebbe barre `fixed` a tutta larghezza (es. menu).
 */
const ALIGN_NO_POSITION_VARIANT_WITH_FLEX = new Set(["centerx", "centery", "centerX", "centerY", "center"]);

function skipPositionVariantForFlex(base: string, variantKey: string, bases: ReadonlySet<string>): boolean {
	if (variantKey !== "absolute,fixed,sticky") return false;
	if (!ALIGN_NO_POSITION_VARIANT_WITH_FLEX.has(base)) return false;
	if (!bases.has("fixed")) return false;
	return bases.has("row") || bases.has("col");
}

/** `left`/`right`/`top`/`bottom` hanno varianti flex (`row`/`col`) e varianti inset (`absolute,fixed,sticky`). */
const INSET_EDGE_BASES = new Set(["left", "right", "top", "bottom"]);

function skipEdgeFlexWhenPositioned(base: string, variantKey: string, bases: ReadonlySet<string>): boolean {
	if (!INSET_EDGE_BASES.has(base)) return false;
	if (variantKey !== "row" && variantKey !== "col") return false;
	return bases.has("absolute") || bases.has("fixed") || bases.has("sticky");
}

function applyResolver(fn: StyleResolver, suffix: string, ctx?: StyleResolverContext): Properties {
	return fn(suffix, ctx) ?? {};
}

function applyDefault(d: StyleResolver | Properties, suffix: string, ctx?: StyleResolverContext): Properties {
	if (typeof d === "function") return applyResolver(d, suffix, ctx);
	return { ...d };
}

export function resolveToken<M extends Record<string, unknown>>(
	map: M,
	base: string,
	suffix: string,
	bases: ReadonlySet<string>,
	ctx?: StyleResolverContext,
): Properties {
	const mergedCtx: StyleResolverContext = { ...ctx, bases };

	const raw = map[base as keyof M] as unknown;
	if (raw == null) return {};

	if (typeof raw === "function") {
		return applyResolver(raw as StyleResolver, suffix, mergedCtx);
	}

	if (isStyleGroup(raw)) {
		const v = raw.variants;
		const fromVariants: Properties = {};
		if (v) {
			for (const [key, val] of Object.entries(v)) {
				if (!variantKeyMatches(key, bases)) continue;
				if (skipPositionVariantForFlex(base, key, bases)) continue;
				if (skipEdgeFlexWhenPositioned(base, key, bases)) continue;
				if (typeof val === "function") Object.assign(fromVariants, applyResolver(val, suffix, mergedCtx));
				else Object.assign(fromVariants, val);
			}
		}
		if (Object.keys(fromVariants).length > 0) return fromVariants;
		return applyDefault(raw.default, suffix, mergedCtx);
	}

	return raw as Properties;
}

const POSITIONED_KIND = new Set(["fixed", "absolute", "sticky"]);

/**
 * Con `fixed` / `absolute` / `sticky`, senza `top`/`bottom` né `left`/`right` (né `inset`)
 * il browser usa la posizione statica e `mt`/`ml` non ancorano come ci si aspetta.
 * Default: `top: 0`, `left: 0` così margin e inset espliciti spostano dal bordo viewport.
 */
export function applyPositionedInsetDefaults(acc: Properties): void {
	const pos = acc.position;
	if (typeof pos !== "string" || !POSITIONED_KIND.has(pos)) return;
	if (acc.inset != null) return;
	if (acc.top == null && acc.bottom == null) acc.top = 0;
	if (acc.left == null && acc.right == null) acc.left = 0;
}

/** Stessa logica su stile già serializzato (merge layer / stringa finale). */
export function applyPositionedInsetDefaultsResolved(style: Record<string, string>): void {
	const pos = style.position;
	if (pos !== "fixed" && pos !== "absolute" && pos !== "sticky") return;
	if (style.inset != null) return;
	if (style.top == null && style.bottom == null) style.top = "0";
	if (style.left == null && style.right == null) style.left = "0";
}

/** Una stringa class (`m-2 flex …`): merge di tutti i `Properties` risolti. */
export function resolveClasses<M extends Record<string, unknown>>(
	map: M,
	classNames: string,
	/** Basi da altri segmenti dello stesso layer (es. `base: "col"` quando si risolve solo `mob: "centerX"`). */
	extraBases?: ReadonlySet<string>,
): Properties {
	const tokens = tokenizeStyleString(classNames);
	const bases = new Set(tokens.map((t) => parseStyleToken(t).base));
	if (extraBases) for (const b of extraBases) bases.add(b);

	let acc: Properties = {};
	const backdropParts: string[] = [];
	for (const token of tokens) {
		const { base, suffix, negative } = parseStyleToken(token);
		const ctx: StyleResolverContext | undefined = negative ? { negative: true, bases } : { bases };
		const resolved = resolveToken(map, base, suffix, bases, ctx) as Record<string | symbol, unknown>;
		const symParts = resolved[FW_BACKDROP_PARTS];
		if (Array.isArray(symParts)) {
			for (const p of symParts) {
				if (typeof p === "string") backdropParts.push(p);
			}
		}
		Object.assign(acc, { ...resolved });
	}
	if (backdropParts.length) {
		const chain = backdropParts.join(" ");
		(acc as Record<string, string>).backdropFilter = chain;
		(acc as Record<string, string>).WebkitBackdropFilter = chain;
	}
	applyPositionedInsetDefaults(acc);
	return acc;
}
