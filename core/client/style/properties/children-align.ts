import type { Properties } from "csstype";
import type { StyleResolver, StyleResolverContext } from "../properties";

/**
 * Allineamento dei **figli** in un `row` / `col` (`children-center`, `children-left`, …).
 * Usa `ctx.bases` da `resolveToken` per sapere se il contenitore è `row` o `col`.
 */
export const childrenAlign: StyleResolver = (suffix: string, ctx?: StyleResolverContext): Properties | undefined => {
	const bases = ctx?.bases;
	const row = bases?.has("row") ?? false;
	const col = bases?.has("col") ?? false;
	switch (suffix) {
		case "center":
			if (row || col) return { justifyContent: "center", alignItems: "center" };
			return undefined;
		case "left":
			if (row) return { justifyContent: "flex-start" };
			if (col) return { alignItems: "flex-start" };
			return undefined;
		case "right":
			if (row) return { justifyContent: "flex-end" };
			if (col) return { alignItems: "flex-end" };
			return undefined;
		case "top":
			if (row) return { alignItems: "flex-start" };
			if (col) return { justifyContent: "flex-start" };
			return undefined;
		case "bottom":
			if (row) return { alignItems: "flex-end" };
			if (col) return { justifyContent: "flex-end" };
			return undefined;
		case "centerx":
			if (row) return { justifyContent: "center" };
			if (col) return { alignItems: "center" };
			return undefined;
		case "centery":
			if (row) return { alignItems: "center" };
			if (col) return { justifyContent: "center" };
			return undefined;
		default:
			return undefined;
	}
};
