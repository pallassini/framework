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
		// NB: usiamo Promise.all così le due chiamate, se il DB è remoto, vengono
		// coalescate dal batcher in un'unica HTTP request (1 round-trip invece di 2).
		const [users, count] = await Promise.all([
			db.users.find(undefined, { limit: 5 }),
			db.users.count(),
		]);
		return {
			ok: true as const,
			mode: dbCustomBackend,
			count,
			users,
		};
	},
});
