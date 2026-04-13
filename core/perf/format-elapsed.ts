/**
 * Durata da `performance.now()` con unità leggibile (s, ms, μs, ns).
 */
export function formatElapsedSince(t0: number): string {
	const dtMs = performance.now() - t0;
	const a = Math.abs(dtMs);
	if (a >= 1000) return `${(dtMs / 1000).toFixed(3)} s`;
	if (a >= 1) return `${dtMs.toFixed(3)} ms`;
	if (a >= 1e-3) return `${(dtMs * 1000).toFixed(2)} μs`;
	if (a === 0) return "0 ns";
	return `${(dtMs * 1e6).toFixed(1)} ns`;
}
