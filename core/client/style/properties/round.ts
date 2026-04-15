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

export function round(suffix: string, ctx?: { negative?: boolean }): Properties | undefined {
	if (ctx?.negative) return undefined;
	if (suffix === "circle") return { borderRadius: "50%" };
	if (clientRoundScale) {
		const row = clientRoundScale[suffix];
		if (row) {
			const vp = styleViewport();
			const borderRadius = row[vp] ?? row.tab ?? row.des ?? row.mob;
			if (borderRadius) return { borderRadius };
		}
	}
	const v = resolveSpacingToken(suffix, "radius");
	if (v) return { borderRadius: v };
	const t = themeCustomPropertyVar(suffix);
	return t ? { borderRadius: t } : undefined;
}
