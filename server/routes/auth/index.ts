import { db } from "db";
import { s, v, error } from "server";

export async function hashPassword(plain: string): Promise<string> {
	return Bun.password.hash(plain, { algorithm: "bcrypt", cost: 12 });
}

export async function verifyPassword(plain: string, passwordHash: string): Promise<boolean> {
	return Bun.password.verify(plain, passwordHash);
}

export const login = s({
	input: v.object({
		email: v.string(),
		password: v.string(),
	}),
	run: async (input) => {
		const rows = await db.users.find({ email: { $eq: input.email } }, { limit: 1 });
		const user = rows[0];
		if (!user) {
			error("UNAUTHORIZED", "Credenziali non valide");
		}
		const ok = await verifyPassword(input.password, user.password as string);
		if (!ok) {
			error("UNAUTHORIZED", "Credenziali non valide");
		}
		return {
			user: {
				id: user.id,
				email: user.email as string,
				username: user.username,
				role: user.role,
			},
		};
	},
});

export const register = s({
	input: v.object({
		email: v.string(),
		password: v.string(),
		username: v.string().optional(),
		role: v.enum(["admin", "user"]).optional(),
	}),
	run: async (input) => {
		const password = await hashPassword(input.password);
		const rows = await db.users.create({
			email: input.email,
			password,
			username: input.username,
			role: input.role ?? "user",
		});
		const user = rows[0];
		return {
			user: {
				id: user.id,
				email: user.email as string,
				username: user.username,
				role: user.role,
			},
		};
	},
});
