import { s } from "server";
import { db } from "../../core/db";

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
