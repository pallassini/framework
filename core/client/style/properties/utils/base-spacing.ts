import type { StyleViewport } from "../../viewport";
import { styleViewport } from "../../viewport";
import { baseViewportRow } from "./base-scale-rem";

/** Scala da `clientConfig.style.base`: suffisso `N` o `base-N` su `p`/`m`/`gap`/… (1–100, anche decimale). */
export type ClientBaseScale = Record<string, Partial<Record<StyleViewport, string>>>;

let clientBaseScale: ClientBaseScale | undefined;

export function setClientBaseScale(scale: ClientBaseScale | undefined): void {
	clientBaseScale = scale;
}

const BASE_PREFIXED_RE = /^base-(\d+(?:\.\d+)?)$/;
const BASE_NUMBER_RE = /^\d+(?:\.\d+)?$/;

/** `base-1`…`base-100` (anche `base-1.2`) oppure `1`…`100` → valore per viewport (`mob` → `tab` → `des`). */
export function resolveBaseSpacingSuffix(s: string): string | null {
	if (!clientBaseScale) return null;
	let key: string | null = null;
	const prefixed = BASE_PREFIXED_RE.exec(s);
	if (prefixed) key = prefixed[1]!;
	else if (BASE_NUMBER_RE.test(s)) key = s;
	if (!key) return null;
	const n = parseFloat(key);
	if (n < 1 || n > 100) return null;
	const row = clientBaseScale[key] ?? baseViewportRow(n);
	if (!row) return null;
	const vp = styleViewport();
	return row[vp] ?? row.tab ?? row.des ?? row.mob ?? null;
}
