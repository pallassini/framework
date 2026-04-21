import type { StyleViewport } from "../../viewport";
import { styleViewport } from "../../viewport";

/** Scala da `clientConfig.style.base`: suffisso `N` o `base-N` su `p`/`m`/`gap`/… (1–100). */
export type ClientBaseScale = Record<string, Partial<Record<StyleViewport, string>>>;

let clientBaseScale: ClientBaseScale | undefined;

export function setClientBaseScale(scale: ClientBaseScale | undefined): void {
	clientBaseScale = scale;
}

const BASE_PREFIXED_RE = /^base-(\d+)$/;
const BASE_NUMBER_RE = /^\d+$/;

/** `base-1`…`base-100` oppure `1`…`100` → valore per viewport (`mob` → `tab` → `des`). */
export function resolveBaseSpacingSuffix(s: string): string | null {
	if (!clientBaseScale) return null;
	let key: string | null = null;
	const prefixed = BASE_PREFIXED_RE.exec(s);
	if (prefixed) key = prefixed[1]!;
	else if (BASE_NUMBER_RE.test(s)) key = s;
	if (!key) return null;
	const row = clientBaseScale[key];
	if (!row) return null;
	const vp = styleViewport();
	return row[vp] ?? row.tab ?? row.des ?? row.mob ?? null;
}
