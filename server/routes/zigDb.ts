import { s } from "server";
import { smokeTest } from "../../core/dbCustom";

/** Smoke Zig (o fallback memory). File separato da `db.ts` così non dipende da Postgres. */
export default s({
	run: async () => smokeTest(),
});
