/**
 * Strumenti di diagnosi memoria/leak runtime.
 *
 * Uso:
 *  - Conta automatica delle iscrizioni globali (listener window/document, watch
 *    creati, observer creati). Espone `__fwLeakProbe` su window per leggere live.
 *  - Periodicamente in dev (se attivo) stampa lo stato in console.
 *
 * Attivazione:
 *   window.__FW_LEAK_PROBE__ = true (oppure localStorage.setItem("__FW_LEAK_PROBE__","1"))
 *   poi reload. Quando spento, costo zero (no log, no setInterval, no patch).
 */

type Counter = {
	created: number;
	disposed: number;
	get live(): number;
};

function makeCounter(): Counter {
	const c = {
		created: 0,
		disposed: 0,
		get live(): number {
			return c.created - c.disposed;
		},
	};
	return c;
}

export const leakCounters: Record<string, Counter> = {
	watch: makeCounter(),
	resizeObserver: makeCounter(),
	mutationObserver: makeCounter(),
	intersectionObserver: makeCounter(),
	docKeydownListeners: makeCounter(),
	docVisibilityListeners: makeCounter(),
	winBeforeUnloadListeners: makeCounter(),
	winScrollListeners: makeCounter(),
	winResizeListeners: makeCounter(),
	formInstances: makeCounter(),
	persistBindings: makeCounter(),
	sessionBindings: makeCounter(),
	popmenuInstances: makeCounter(),
	inputStringInstances: makeCounter(),
};

/** Bumpers usati dai vari moduli del framework. Costo trascurabile. */
export function bump(key: keyof typeof leakCounters, kind: "create" | "dispose"): void {
	const c = leakCounters[key];
	if (!c) return;
	if (kind === "create") c.created++;
	else c.disposed++;
}

let installed = false;
let printerId: ReturnType<typeof setInterval> | null = null;

export function isLeakProbeEnabled(): boolean {
	if (typeof window === "undefined") return false;
	const w = window as unknown as { __FW_LEAK_PROBE__?: boolean };
	if (w.__FW_LEAK_PROBE__) return true;
	try {
		return localStorage.getItem("__FW_LEAK_PROBE__") === "1";
	} catch {
		return false;
	}
}

function snapshot(): Record<string, { live: number; created: number; disposed: number }> {
	const out: Record<string, { live: number; created: number; disposed: number }> = {};
	for (const [k, c] of Object.entries(leakCounters)) {
		out[k] = { live: c.live, created: c.created, disposed: c.disposed };
	}
	return out;
}

/** DOM staccato osservabile via DevTools, ma qui contiamo elementi connessi che hanno data-fw. */
function domSummary(): { fwInputs: number; fwClickHooks: number; allNodes: number } {
	if (typeof document === "undefined") return { fwInputs: 0, fwClickHooks: 0, allNodes: 0 };
	return {
		fwInputs: document.querySelectorAll("[data-fw-form]").length,
		fwClickHooks: document.querySelectorAll("[data-fw-click]").length,
		allNodes: document.getElementsByTagName("*").length,
	};
}

export function installLeakProbe(): void {
	if (installed) return;
	if (!isLeakProbeEnabled()) return;
	installed = true;

	const w = window as unknown as { __fwLeakProbe?: unknown };
	w.__fwLeakProbe = {
		snapshot,
		dom: domSummary,
		counters: leakCounters,
		dump(): void {
			console.log("[fw.leakProbe]", { counters: snapshot(), dom: domSummary() });
		},
	};

	console.log("[fw.leakProbe] installed. Use window.__fwLeakProbe.dump()");

	printerId = setInterval(() => {
		const counters = snapshot();
		const dom = domSummary();
		console.log("[fw.leakProbe.tick]", { counters, dom });
	}, 15000);
}

export function uninstallLeakProbe(): void {
	if (!installed) return;
	installed = false;
	if (printerId) {
		clearInterval(printerId);
		printerId = null;
	}
}

if (typeof window !== "undefined") {
	(window as unknown as { __fwLeakBump?: (k: string, t: "create" | "dispose") => void }).__fwLeakBump = (
		k,
		t,
	) => {
		const c = leakCounters[k as keyof typeof leakCounters];
		if (!c) return;
		if (t === "create") c.created++;
		else c.disposed++;
	};
	queueMicrotask(() => {
		try {
			installLeakProbe();
		} catch {
			/* */
		}
	});
}
