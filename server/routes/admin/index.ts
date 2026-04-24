import { db } from "db";
import { error, s, v } from "server";
import { hashPassword } from "../auth/index";

export const getUsers = s({
	auth: true,
	run: async () => {
		const users = await db.users.find();
		return users;
	},
});

/** Patch riga `users`: stesso schema della tabella (campi opzionali), `id` obbligatorio; `password` in chiaro → hash come in registrazione. */
export const userUpdate = s({
	auth: true,
	input: db.users.partial({ with: { id: v.string() }, min: 1 }),
	run: async (input) => {
		const { id, ...patch } = input as { id: string } & Record<string, unknown>;
		const set: Record<string, unknown> = { ...patch };
		if (Object.prototype.hasOwnProperty.call(set, "password")) {
			const p = set["password"];
			if (p === undefined) delete set["password"];
			else set["password"] = await hashPassword(String(p));
		}
		if (Object.prototype.hasOwnProperty.call(set, "email") && set["email"] !== undefined) {
			set["email"] = v.email().parse(set["email"]);
		}
		const res = await db.users.update({ where: { id }, set: set as never });
		if (res.count === 0) error("NOT_FOUND", `user ${id}`);
		return { user: res.rows[0]! };
	},
});

export const userDelete = s({
	auth: true,
	input: v.object({ id: v.string() }),
	run: async ({ id }) => {
		const res = await db.users.delete({ where: { id } });
		if (res.count === 0) error("NOT_FOUND", `user ${id}`);
		return { ok: true as const };
	},
});
