import type { Properties } from "csstype";

/** Massimo / minimo pratico (come molti browser mappano gli estremi di stacking). */
const Z_TOP = 2_147_483_647;
const Z_BACK = -2_147_483_647;

export function zIndex(suffix: string, ctx?: { negative?: boolean }): Properties | undefined {
	if (suffix === "top") return ctx?.negative ? undefined : { zIndex: Z_TOP };
	if (suffix === "back") return ctx?.negative ? undefined : { zIndex: Z_BACK };
	/**
	 * Layer Popmenu (portal sotto `body`): variabili in `core/client/index.css` (`--fw-z-popmenu-*`).
	 * Usa `s="z-popmenu-portal"` ecc. se serve allineare altri overlay agli stessi livelli.
	 */
	if (suffix === "popmenu-portal") {
		return ctx?.negative ? undefined : { zIndex: "var(--fw-z-popmenu-portal, 2147483646)" };
	}
	if (suffix === "popmenu-backdrop") {
		return ctx?.negative ? undefined : { zIndex: "var(--fw-z-popmenu-backdrop, 100001)" };
	}
	if (suffix === "popmenu-shell") {
		return ctx?.negative ? undefined : { zIndex: "var(--fw-z-popmenu-shell, 100002)" };
	}
	if (/^\d+$/.test(suffix)) {
		const n = Number(suffix);
		return { zIndex: ctx?.negative ? -n : n };
	}
	return undefined;
}
