/**
 * Soft delete: `deletedAt` nullo = riga attiva.
 * `notNull` = operatore `where` “campo valorizzato” (`{ $ne: null }`). In JS **non** usare `!null` (è `true`).
 */
export const deletedAtLive = { deletedAt: null } as const;

/** Uso: `deletedAt: notNull` dentro `where` / `get.with({ where: { … } })`. */
export const notNull = { $ne: null } as const;
