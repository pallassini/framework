/**
 * Spezza su virgole solo a profondità parentesi 0.
 */
export function splitTopLevelCommas(s: string): string[] {
	const out: string[] = [];
	let depth = 0;
	let start = 0;
	for (let i = 0; i < s.length; i++) {
		const ch = s[i]!;
		if (ch === "(") depth++;
		else if (ch === ")") depth = Math.max(0, depth - 1);
		else if (ch === "," && depth === 0) {
			out.push(s.slice(start, i).trim());
			start = i + 1;
		}
	}
	out.push(s.slice(start).trim());
	return out.filter(Boolean);
}

/**
 * Corpo tipo `#fff 40%, rgba(0,0,0,0.5) 30%` (opzionalmente tra parentesi) →
 * `radial-gradient(circle, …, transparent 100%)`.
 */
export function buildRadialGradientFromStops(spec: string): string | undefined {
	let inner = spec.trim();
	if (inner.startsWith("(") && inner.endsWith(")")) {
		inner = inner.slice(1, -1).trim();
	}
	if (!inner) return undefined;

	let parts = splitTopLevelCommas(inner);
	const head = parts[0]?.trim().toLowerCase();
	if (head === "circle" || head === "radial") {
		parts = parts.slice(1);
	}
	const stops: string[] = [];
	for (const p of parts) {
		const m = p.match(/^(.+?)\s+(\d+(?:\.\d+)?)%\s*$/);
		if (!m) return undefined;
		const color = m[1]!.trim();
		const pct = m[2]!;
		stops.push(`${color} ${pct}%`);
	}
	if (!stops.length) return undefined;
	return `radial-gradient(circle, ${stops.join(", ")}, transparent 100%)`;
}

const LINEAR_ANGLE_RE = /^\d+(\.\d+)?(deg|rad|grad|turn)$/i;

/**
 * `linear, 180deg, var(--x), transparent` oppure `180deg, var(--x), transparent` → `linear-gradient(...)`.
 */
export function buildLinearGradientFromSpec(spec: string): string | undefined {
	let inner = spec.trim();
	if (inner.startsWith("(") && inner.endsWith(")")) {
		inner = inner.slice(1, -1).trim();
	}
	const parts = splitTopLevelCommas(inner);
	if (parts.length < 2) return undefined;

	const p0 = parts[0]!.trim();
	const p0Lower = p0.toLowerCase();

	if (p0Lower === "linear") {
		if (parts.length < 3) return undefined;
		const dir = parts[1]!.trim();
		const stops = parts.slice(2).join(", ");
		return `linear-gradient(${dir}, ${stops})`;
	}

	if (LINEAR_ANGLE_RE.test(p0)) {
		const stops = parts.slice(1).join(", ");
		return `linear-gradient(${p0}, ${stops})`;
	}

	return undefined;
}
