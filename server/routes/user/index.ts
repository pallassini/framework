import { db } from "db";
import { error, s, v } from "server";
import { hashPassword } from "../auth/index";

/**
 * Aggiorna la riga `users` dell'utente autenticato (no `id` in input: si usa sempre la sessione).
 * `password` in chiaro → hash. Non consente di cambiare `role` né `id`.
 */
export const update = s({
	auth: true,
	input: db.users.partial({ min: 1 }),
	run: async (input, ctx) => {
		const id = ctx.user!.id;
		const set: Record<string, unknown> = { ...(input as Record<string, unknown>) };
		delete set["id"];
		delete set["role"];
		delete set["passwordUpdatedAt"];
		if (Object.prototype.hasOwnProperty.call(set, "password")) {
			const p = set["password"];
			if (p === undefined) delete set["password"];
			else {
				set["password"] = await hashPassword(String(p));
				set["passwordUpdatedAt"] = new Date();
			}
		}
		if (Object.prototype.hasOwnProperty.call(set, "email") && set["email"] !== undefined) {
			set["email"] = v.email().parse(set["email"]);
		}
		const res = await db.users.update({ where: { id }, set: set as never });
		if (res.count === 0) error("NOT_FOUND", `user ${id}`);
		return { user: res.rows[0]! };
	},
});
