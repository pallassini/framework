/**
 * Esempio d'uso del DB (locale o remoto a seconda di FWDB_REMOTE).
 *
 * L'API è la stessa in entrambe le modalità:
 *   - `bun dev`               → opera sul DB locale (core/db/data)
 *   - `bun dev:remote`        → opera sul DB remoto (alias "prod")
 *
 * Chiamata dal client: `await server.test()` → ritorna `{ ok, mode, users, count }`.
 */
import { s } from "server";
import { db, dbCustomBackend } from "db";

export default s({
	async run() {
		const users = await db.users.find(undefined, { limit: 5 });
		const count = await db.users.count();
		return {
			ok: true as const,
			mode: dbCustomBackend,
			count,
			users,
		};
	},
});
