import { s } from "server";
import { db } from "../../core/db";
import { smokeTest } from "../../core/dbCustom";

export default s({
	run: async () => {
		const rows = await db`
			select
				current_database() as database,
				current_user as db_user,
				now() as server_time
		`;
		return { ok: true as const, rows };
	},
});

/** Motore Zig / fallback memory — stesso file del Postgres così in prod si carica insieme a `db`. */
export const custom = s({
	run: async () => smokeTest(),
});
