import type { Properties } from "csstype";

/** Massimo / minimo pratico (come molti browser mappano gli estremi di stacking). */
const Z_TOP = 2_147_483_647;
const Z_BACK = -2_147_483_647;

export function zIndex(suffix: string): Properties | undefined {
	if (suffix === "top") return { zIndex: Z_TOP };
	if (suffix === "back") return { zIndex: Z_BACK };
	if (/^\d+$/.test(suffix)) return { zIndex: Number(suffix) };
	return undefined;
}
