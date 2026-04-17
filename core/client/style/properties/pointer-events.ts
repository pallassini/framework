import type { Properties } from "csstype";
import type { StyleResolver } from "../properties";

/** `no-events` → `pointer-events: none` (parse: base `no`, suffisso `events`). */
export const noPrefix: StyleResolver = (suffix: string): Properties | undefined => {
	if (suffix === "events") return { pointerEvents: "none" };
	return undefined;
};

/** `events-none` / `events-auto` → `pointer-events`. */
export const eventsPointer: StyleResolver = (suffix: string): Properties | undefined => {
	const s = suffix.trim();
	if (s === "none") return { pointerEvents: "none" };
	if (s === "auto") return { pointerEvents: "auto" };
	return undefined;
};
