/**
 * Session state (tab-scoped) — stessi building block di `state/createState`.
 * Usa `sessionState` da `client`; qui restano re-export per logica dedicata in seguito.
 */
export { createState as createSessionRoot } from "..";
export type { Signal, StateMap } from "..";
