import type { Properties } from "csstype";
import type { StyleGroup, StyleResolver } from "./properties";

export function parseStyleToken(token: string): { base: string; suffix: string } {
	const i = token.indexOf("-");
	if (i === -1) return { base: token, suffix: "" };
	return { base: token.slice(0, i), suffix: token.slice(i + 1) };
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

function applyResolver(fn: StyleResolver, suffix: string): Properties {
	return fn(suffix) ?? {};
}

function applyDefault(d: StyleResolver | Properties, suffix: string): Properties {
	if (typeof d === "function") return applyResolver(d, suffix);
	return { ...d };
}

export function resolveToken<M extends Record<string, unknown>>(
	map: M,
	base: string,
	suffix: string,
	bases: ReadonlySet<string>,
): Properties {
	const raw = map[base as keyof M] as unknown;
	if (raw == null) return {};

	if (typeof raw === "function") {
		return applyResolver(raw as StyleResolver, suffix);
	}

	if (isStyleGroup(raw)) {
		const v = raw.variants;
		const fromVariants: Properties = {};
		if (v) {
			for (const [key, val] of Object.entries(v)) {
				if (!variantKeyMatches(key, bases)) continue;
				if (typeof val === "function") Object.assign(fromVariants, applyResolver(val, suffix));
				else Object.assign(fromVariants, val);
			}
		}
		if (Object.keys(fromVariants).length > 0) return fromVariants;
		return applyDefault(raw.default, suffix);
	}

	return raw as Properties;
}

/** Una stringa class (`m-2 flex …`): merge di tutti i `Properties` risolti. */
export function resolveClasses<M extends Record<string, unknown>>(map: M, classNames: string): Properties {
	const tokens = classNames.trim().split(/\s+/).filter(Boolean);
	const bases = new Set(tokens.map((t) => parseStyleToken(t).base));

	let acc: Properties = {};
	for (const token of tokens) {
		const { base, suffix } = parseStyleToken(token);
		Object.assign(acc, resolveToken(map, base, suffix, bases));
	}
	return acc;
}
