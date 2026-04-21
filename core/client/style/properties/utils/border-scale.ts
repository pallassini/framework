import type { StyleViewport } from "../../viewport";
import { styleViewport } from "../../viewport";

/** Scala larghezza bordo da `clientConfig.style.border`: `b-1`…`b-N` (valori in `px` o `rem`). */
export type ClientBorderScale = Record<string, Partial<Record<StyleViewport, string>>>;

let clientBorderScale: ClientBorderScale | undefined;

export function setClientBorderScale(scale: ClientBorderScale | undefined): void {
	clientBorderScale = scale;
}

const BORDER_SUFFIX_RE = /^\d+$/;

/** Suffisso `1`…`N` → spessore bordo per viewport (`mob` → `tab` → `des`). */
export function resolveBorderScaleSuffix(s: string): string | null {
	if (!clientBorderScale) return null;
	if (!BORDER_SUFFIX_RE.test(s)) return null;
	const row = clientBorderScale[s];
	if (!row) return null;
	const vp = styleViewport();
	return row[vp] ?? row.tab ?? row.des ?? row.mob ?? null;
}
