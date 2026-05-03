/**
 * Superficie `db` **solo browser** (Vite): niente `core/db/index` né `node:fs`.
 * Il path `"db"` nel client è risolto qui via `resolve.alias` in `vite.config.ts` / `vite.booker.config.ts`.
 */
export { deletedAtLive, notNull } from "./db/core/soft-delete-where";
export * from "./client/validator";
