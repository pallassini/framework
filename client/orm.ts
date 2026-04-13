/**
 * Punto d’ingresso corto: re-export di tutto `core/client/db/orm` (implementazione vera).
 * Tabelle = `createDb().folder(…).table("nome")` → vedi `core/client/db/orm/orm.ts`.
 *
 * Import: `from "../client/orm"` oppure `from "client"` (barrel in `core/client.ts`).
 */
export * from "../core/client/db/orm";
