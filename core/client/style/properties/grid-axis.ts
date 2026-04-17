import type { Properties } from "csstype";

/** Limite pratico per `col-N` / `row-N` (evita stringhe enormi in `repeat()`). */
const MAX_GRID_AXIS = 24;

function parseAxisCount(suffix: string): number | null {
	if (!suffix || !/^[1-9]\d*$/.test(suffix)) return null;
	const n = Number(suffix);
	if (!Number.isInteger(n) || n < 1 || n > MAX_GRID_AXIS) return null;
	return n;
}

/** `col-N`: griglia a **N colonne** uguali, flusso riga per riga (1° colonna 1, 2° colonna 2, …). */
export function gridTemplateColumnsEqual(suffix: string): Properties | undefined {
	const n = parseAxisCount(suffix);
	if (n == null) return undefined;
	return {
		display: "grid",
		gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`,
	};
}

/**
 * `row-N`: griglia a **N righe** uguali, flusso **per colonne** (`grid-auto-flow: column`)
 * così l’ordine DOM coincide con col-N a parità di area (1° riga 1, 2° riga 2, 3° colonna 1, …).
 */
export function gridTemplateRowsEqualFlowColumn(suffix: string): Properties | undefined {
	const n = parseAxisCount(suffix);
	if (n == null) return undefined;
	return {
		display: "grid",
		gridTemplateRows: `repeat(${n}, minmax(0, 1fr))`,
		gridAutoFlow: "column",
	};
}
