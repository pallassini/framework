import { watch } from "../../state/effect";
import { des } from "./des";
import { mob } from "./mob";
import { tab } from "./tab";

export { mob, tab, des };

export type StyleViewport = "mob" | "tab" | "des";

export const BREAKPOINTS = { mob, tab, des } as const;

export function getViewportSize(): StyleViewport {
	if (typeof window === "undefined") return "des";
	const w = window.innerWidth;
	if (w <= mob.max) return "mob";
	if (w <= tab.max) return "tab";
	return "des";
}

const [readViewport, writeViewport] = watch.source<StyleViewport>(getViewportSize());

let resizeBound = false;

function ensureResizeListener(): void {
	if (typeof window === "undefined" || resizeBound) return;
	resizeBound = true;
	window.addEventListener("resize", () => {
		writeViewport(getViewportSize());
	});
}

/** Viewport corrente; dentro `watch()` si sottoscrive ai resize. */
export function styleViewport(): StyleViewport {
	ensureResizeListener();
	return readViewport();
}
