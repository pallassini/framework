import { db } from "db";
import { FIELD_OPTIONAL } from "../../../core/client/validator/field-meta";
import type { InputSchema } from "../../../core/client/validator/properties/defs";
import type { CreateInput } from "../../../core/db/core/types";
import type { ServerTables } from "../../../core/db";
import { getFwTableShape } from "../../../core/db/schema/table";
import { s, v, error } from "server";
import { serverConfig } from "../../config";

function toOptionalSchema(sch: InputSchema<unknown>): InputSchema<unknown> {
	if (typeof sch === "object" && sch !== null && FIELD_OPTIONAL in (sch as object)) return sch;
	const maybe = (sch as { optional?: () => InputSchema<unknown> }).optional;
	return typeof maybe === "function" ? maybe.call(sch) : sch;
}

type UserCreate = CreateInput<ServerTables["users"]>;
/**
 * Stesso `CreateInput` tranne `password` in chiaro (tutto il resto, incluso `role`, come in tabella / enum).
 * `login` non è su DB: solo se `true` il server crea la sessione (comporta “resta loggato” come il login).
 */
type RegisterIn = Omit<UserCreate, "password" | "passwordUpdatedAt"> & {
	password: string;
	login?: boolean;
};

/**
 * Stesso criterio di `db.users` in create, ma `password` = testo in chiaro (`v.password()`).
 * `role` e gli altri campi non opzionali a DB vanno passati: se mancano o non sono validi, `parse` fallisce.
 * Aggiungendo colonne a `users` in `db/index.ts`, l’input RPC segue il DB.
 */
const userRegisterInput: InputSchema<RegisterIn> = (() => {
	const fw = db.schema.fwTables.find((t) => t.name === "users");
	if (!fw) throw new Error("[auth.register] tabella `users` non nello schema");
	const shape = getFwTableShape(fw);
	if (!shape) throw new Error("[auth.register] shape `users` assente");
	const reg: Record<string, InputSchema<unknown>> = {};
	for (const [k, s0] of Object.entries(shape)) {
		if (k === "password") {
			reg[k] = v.password();
			continue;
		}
		if (k === "passwordUpdatedAt") {
			continue;
		}
		if (k === "id" || k === "createdAt" || k === "updatedAt") {
			reg[k] = toOptionalSchema(s0);
			continue;
		}
		reg[k] = s0;
	}
	reg["login"] = v.optional(v.boolean());
	return v.object(reg) as InputSchema<RegisterIn>;
})();

/**
 * Qualsiasi campo **diverso da `password`** presente nella tabella `users` viene esposto al client.
 * Tipo derivato da `db.users.row` → aggiungendo colonne in `db/index.ts` il client le vede senza modificare altro.
 * Le `Date` vengono serializzate in ISO string (coerenza JSON).
 */
type UserRow = Awaited<ReturnType<typeof db.users.find>>[number];
export type PublicUser = {
	[K in keyof UserRow as K extends "password" ? never : K]: UserRow[K] extends Date | undefined
		? string | undefined
		: UserRow[K] extends Date | null | undefined
			? string | null
			: UserRow[K];
};

const SENSITIVE_USER_FIELDS = new Set(["password"]);

function toIsoIfDate(v: unknown): unknown {
	if (v instanceof Date) return v.toISOString();
	return v;
}

function publicUserFromRow(u: UserRow): PublicUser {
	const out: Record<string, unknown> = {};
	for (const [k, v] of Object.entries(u as Record<string, unknown>)) {
		if (SENSITIVE_USER_FIELDS.has(k)) continue;
		out[k] = toIsoIfDate(v);
	}
	return out as PublicUser;
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
			error("UNAUTHORIZED", "Email non trovata");
		}
		const ok = await verifyPassword(input.password, user.password as string);
		if (!ok) {
			error("UNAUTHORIZED", "Password errata");
		}
		const sess = await createSession(user.id);
		return {
			user: publicUserFromRow(user),
			sessionId: sess.id,
		};
	},
});

export const register = s({
	input: userRegisterInput,
	rateLimit: serverConfig.auth.rateLimit,
	run: async (input, _ctx) => {
		const { password: plain, login, ...row } = input;
		const password = await hashPassword(plain);
		const rows = await db.users.create({
			...row,
			password,
			passwordUpdatedAt: new Date(),
		});
		const user = rows[0]!;
		const u = publicUserFromRow(user);
		if (login === true) {
			const sess = await createSession(user.id);
			return { user: u, sessionId: sess.id };
		}
		return { user: u };
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
