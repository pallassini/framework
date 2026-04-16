import type { Properties } from "csstype";

function angleCss(suffix: string): string | undefined {
	if (!suffix) return undefined;
	if (/^-?\d+(\.\d+)?(deg|rad|grad|turn)$/.test(suffix)) return suffix;
	if (/^-?\d+(\.\d+)?$/.test(suffix)) return `${suffix}deg`;
	return undefined;
}

/** `rotate-90` → `transform: rotate(90deg)`; suffisso con unità (`45deg`, `0.5turn`) passa così com’è. `-rotate-45` → `-45deg`. */
export function rotate(suffix: string, ctx?: { negative?: boolean }): Properties | undefined {
	const a = angleCss(suffix);
	if (!a) return undefined;
	const signed = ctx?.negative ? (a.startsWith("-") ? a.slice(1) : `-${a}`) : a;
	return { transform: `rotate(${signed})` };
}
