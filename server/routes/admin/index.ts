import { db } from "db";
import { error, s, v } from "server";

export const getUsers = s({
	auth: true,
	run: async () => {
		const users = await db.users.find();
		return users;
	},
});

/** Aggiorna un solo campo “sicuro” per riga (niente password / ruolo da qui). */
export const patchUser = s({
	auth: true,
	input: v.object({
		id: v.string(),
		field: v.enum(["email", "username", "domain"]),
		value: v.string(),
	}),
	run: async ({ id, field, value }) => {
		const patch =
			field === "email"
				? { email: v.email().parse(value) }
				: field === "username"
					? { username: value }
					: { domain: value };
		const res = await db.users.update({ where: { id }, set: patch });
		if (res.count === 0) error("NOT_FOUND", `user ${id}`);
		return { user: res.rows[0]! };
	},
});
