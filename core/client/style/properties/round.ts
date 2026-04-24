import type { Properties } from "csstype";
import type { StyleViewport } from "../viewport";
import { styleViewport } from "../viewport";
import { resolveSpacingToken } from "./utils/units";
import { themeCustomPropertyVar } from "./utils/themeVar";

/** Scala `border-radius` da `clientConfig.style.round`: `round-1`…`round-5`, `round-circle`. */
export type ClientRoundScale = Record<string, Partial<Record<StyleViewport, string>>>;

let clientRoundScale: ClientRoundScale | undefined;

export function setClientRoundScale(scale: ClientRoundScale | undefined): void {
	clientRoundScale = scale;
}

/** Valore CSS per `border-*-radius` (stessa risoluzione di `round-*`). */
export function resolveRoundRadiusCss(suffix: string): string | undefined {
	if (!suffix) return undefined;
	if (suffix === "circle") return "50%";
	if (clientRoundScale) {
		const row = clientRoundScale[suffix];
		if (row) {
			const vp = styleViewport();
			const borderRadius = row[vp] ?? row.tab ?? row.des ?? row.mob;
			if (borderRadius) return borderRadius;
		}
	}
	const v = resolveSpacingToken(suffix, "radius");
	if (v) return v;
	const t = themeCustomPropertyVar(suffix);
	return t ?? undefined;
}

type Corner = "tl" | "tr" | "bl" | "br";

function directionalRound(
	suffix: string,
	corners: Record<Corner, boolean>,
	ctx?: { negative?: boolean },
): Properties | undefined {
	if (ctx?.negative) return undefined;
	const r = resolveRoundRadiusCss(suffix);
	if (!r) return undefined;
	const out: Properties = {};
	if (corners.tl) out.borderTopLeftRadius = r;
	if (corners.tr) out.borderTopRightRadius = r;
	if (corners.bl) out.borderBottomLeftRadius = r;
	if (corners.br) out.borderBottomRightRadius = r;
	return out;
}

export function round(suffix: string, ctx?: { negative?: boolean }): Properties | undefined {
	if (ctx?.negative) return undefined;
	const r = resolveRoundRadiusCss(suffix);
	if (r) return { borderRadius: r };
	return undefined;
}

/** `roundt-*` — solo angoli superiori (come il bordo superiore del wrapper arrotondato). */
export function roundt(suffix: string, ctx?: { negative?: boolean }): Properties | undefined {
	return directionalRound(suffix, { tl: true, tr: true, bl: false, br: false }, ctx);
}

/** `roundb-*` — solo angoli inferiori. */
export function roundb(suffix: string, ctx?: { negative?: boolean }): Properties | undefined {
	return directionalRound(suffix, { tl: false, tr: false, bl: true, br: true }, ctx);
}

/** `roundl-*` — solo a sinistra (top-left + bottom-left). */
export function roundl(suffix: string, ctx?: { negative?: boolean }): Properties | undefined {
	return directionalRound(suffix, { tl: true, tr: false, bl: true, br: false }, ctx);
}

/** `roundr-*` — solo a destra (top-right + bottom-right). */
export function roundr(suffix: string, ctx?: { negative?: boolean }): Properties | undefined {
	return directionalRound(suffix, { tl: false, tr: true, bl: false, br: true }, ctx);
}

/** `roundtl-*` — solo top-left. */
export function roundtl(suffix: string, ctx?: { negative?: boolean }): Properties | undefined {
	return directionalRound(suffix, { tl: true, tr: false, bl: false, br: false }, ctx);
}

/** `roundtr-*` — solo top-right. */
export function roundtr(suffix: string, ctx?: { negative?: boolean }): Properties | undefined {
	return directionalRound(suffix, { tl: false, tr: true, bl: false, br: false }, ctx);
}

/** `roundbl-*` — solo bottom-left. */
export function roundbl(suffix: string, ctx?: { negative?: boolean }): Properties | undefined {
	return directionalRound(suffix, { tl: false, tr: false, bl: true, br: false }, ctx);
}

/** `roundbr-*` — solo bottom-right. */
export function roundbr(suffix: string, ctx?: { negative?: boolean }): Properties | undefined {
	return directionalRound(suffix, { tl: false, tr: false, bl: false, br: true }, ctx);
}
