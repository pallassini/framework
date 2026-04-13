import { IndexedMemoryEngine } from "./indexedEngine";

/**
 * Store process-wide per `ormDoc` + simulazioni dashboard.
 * Indici invertiti automatici su campi scalari (eq veloci); `clearTablePrefix` per isolare `/app/dash`.
 */
export const ormDocStore = new IndexedMemoryEngine();
