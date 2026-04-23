import { db } from "db";
import { s, v, error } from "server";
import { serverConfig } from "../../config";

/** Tutti i campi della tabella `users` tranne `password` (mai esposto al client). */
function publicUserFromRow(u: {
	id: string;
	email: unknown;
	password?: unknown;
	username?: unknown;
	role: unknown;
	createdAt?: unknown;
	updatedAt?: unknown;
	deletedAt?: unknown;
}) {
	const iso = (d: unknown): string | undefined => {
		if (d == null) return undefined;
		if (d instanceof Date) return d.toISOString();
		if (typeof d === "string") return d;
		return String(d);
	};
	const isoNull = (d: unknown): string | null => {
		if (d == null) return null;
		if (d instanceof Date) return d.toISOString();
		if (typeof d === "string") return d;
		return String(d);
	};
	return {
		id: u.id,
		email: u.email as string,
		username: u.username as string | undefined,
		role: u.role as "admin" | "user" | "customer",
		createdAt: iso(u.createdAt),
		updatedAt: iso(u.updatedAt),
		deletedAt: isoNull(u.deletedAt),
	};
}

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
		email: v.email(),
		/** Stesso criterio del client: `v.password("noError")` — niente min in validazione. */
		password: v.password("noError"),
	}),
	/** Per IP (in-memory). Regola in `core/server/middlewares/limit.ts` + `server/config.ts` → `auth.rateLimit`. */
	rateLimit: serverConfig.auth.rateLimit,
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
			user: publicUserFromRow(user),
			sessionId: sess.id,
		};
	},
});

export const register = s({
	input: v.object({
		email: v.email(),
		password: v.password(),
		username: v.string().optional(),
		role: v.enum(["admin", "user"]).optional(),
	}),
	rateLimit: serverConfig.auth.rateLimit,
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
			user: publicUserFromRow(user),
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
			user: publicUserFromRow(u),
		};
	},
});
