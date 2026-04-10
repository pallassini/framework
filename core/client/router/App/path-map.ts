/** Path file Vite glob → pattern router. */

export function routePatternFromFilePath(input: string): string | null {
	const norm = input.replace(/\\/g, "/");
	const fromGlob = norm.match(/\/routes\/(.+?)\.(?:tsx?|jsx?)$/);
	if (fromGlob) return segmentToPath(fromGlob[1]);
	const fromRel = norm.match(/^(.+?)\.(?:tsx?|jsx?)$/);
	if (fromRel) return segmentToPath(fromRel[1]);
	return null;
}

function segmentToPath(seg: string): string {
	if (seg === "index") return "/";
	if (seg.endsWith("/index")) return "/" + seg.slice(0, -"/index".length);
	if (seg.includes("[...")) return "*";
	return "/" + seg.replace(/\[([^\]]+)\]/g, ":$1");
}
