import { error } from "../../error";

/** Coda con `max` attivi e `buffer` in attesa (default buffer = infinito). */
export function createGate(max: number, buffer: number | undefined) {
	const m = Math.max(1, Math.floor(max));
	const buf = buffer == null ? Number.POSITIVE_INFINITY : Math.max(0, Math.floor(buffer));
	let active = 0;
	const queue: Array<() => void> = [];

	return {
		async acquire(): Promise<{ waited: boolean }> {
			let waited = false;
			if (active >= m) {
				if (queue.length >= buf) error("CONCURRENCY_LIMIT", "Too many concurrent requests");
				waited = true;
				await new Promise<void>((resolve) => queue.push(resolve));
			}
			active++;
			return { waited };
		},
		release(): void {
			active = Math.max(0, active - 1);
			const next = queue.shift();
			if (next) next();
		},
		snapshot(): { active: number; max: number; queued: number } {
			return { active, max: m, queued: queue.length };
		},
		isIdle(): boolean {
			return active === 0 && queue.length === 0;
		},
	};
}

export type Gate = ReturnType<typeof createGate>;
