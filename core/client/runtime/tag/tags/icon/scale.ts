import type { StyleViewport } from "../../../../style/viewport";
import { styleViewport } from "../../../../style/viewport";

export type ClientIconScale = Record<string, Partial<Record<StyleViewport, string>>>;

let clientIconScale: ClientIconScale | undefined;

export function setClientIconScale(scale: ClientIconScale | undefined): void {
	clientIconScale = scale;
}

/** Risolve una chiave della scala `clientConfig.style.icon` (es. `size={2}` → `"2"`). */
export function resolveIconSizeFromScaleKey(key: string): string | undefined {
	if (!clientIconScale) return undefined;
	const row = clientIconScale[key];
	if (!row) return undefined;
	const vp = styleViewport();
	return row[vp] ?? row.tab ?? row.des ?? row.mob;
}
