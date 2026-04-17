import type { Properties } from "csstype";
import type { StyleResolver } from "../properties";

/** Questo elemento nel flex genitore: `self-start`, `self-center`, `self-end`, `self-stretch`. */
export const selfAlign: StyleResolver = (suffix: string): Properties | undefined => {
	switch (suffix) {
		case "start":
			return { alignSelf: "flex-start" };
		case "center":
			return { alignSelf: "center" };
		case "end":
			return { alignSelf: "flex-end" };
		case "stretch":
			return { alignSelf: "stretch" };
		default:
			return undefined;
	}
};
