import { db } from "db";
import { s, v, error } from "server";

export async function hashPassword(plain: string): Promise<string> {
	return Bun.password.hash(plain, { algorithm: "bcrypt", cost: 12 });
}

export async function verifyPassword(plain: string, passwordHash: string): Promise<boolean> {
	return Bun.password.verify(plain, passwordHash);
}

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

async function createSession(userId: string) {
	const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
	const rows = await db.sessions.create({
		userId,
		expiresAt,
		revokedAt: undefined,
	});
	return rows[0]!;
}

export const login = s({
	input: v.object({
		email: v.string(),
		password: v.string(),
	}),
	run: async (input, _ctx) => {
		const rows = await db.users.find({ email: { $eq: input.email } }, { limit: 1 });
		const user = rows[0];
		if (!user) {
			error("UNAUTHORIZED", "Credenziali non valide");
		}
		const ok = await verifyPassword(input.password, user.password as string);
		if (!ok) {
			error("UNAUTHORIZED", "Credenziali non valide");
		}
		const sess = await createSession(user.id);
		return {
			user: {
				id: user.id,
				email: user.email as string,
				username: user.username,
				role: user.role,
			},
			sessionId: sess.id,
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
	run: async (input, _ctx) => {
		const password = await hashPassword(input.password);
		const rows = await db.users.create({
			email: input.email,
			password,
			username: input.username,
			role: input.role ?? "user",
		});
		const user = rows[0]!;
		const sess = await createSession(user.id);
		return {
			user: {
				id: user.id,
				email: user.email as string,
				username: user.username,
				role: user.role,
			},
			sessionId: sess.id,
		};
	},
});

/** Utente corrente da sessione (header `Authorization` / `x-session-id`). */
export const me = s({
	auth: true,
	run: async (ctx) => {
		const uid = ctx.auth!.userId;
		const rows = await db.users.find({ id: { $eq: uid } }, { limit: 1 });
		const u = rows[0];
		if (!u) error("NOT_FOUND", "User");
		return {
			user: {
				id: u.id,
				email: u.email as string,
				username: u.username,
				role: u.role,
			},
		};
	},
});
