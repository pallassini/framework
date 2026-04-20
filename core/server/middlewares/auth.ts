import { db } from "db";
import { error } from "../error";
import type { ServerContext } from "../routes/context";
import type { Middleware } from "./logic/types";

function sessionIdFromHeaders(headers: Headers): string | undefined {
	const auth = headers.get("authorization");
	if (auth?.toLowerCase().startsWith("bearer ")) {
		const t = auth.slice(7).trim();
		if (t) return t;
	}
	return headers.get("x-session-id")?.trim() || undefined;
}

function expiresAtMs(exp: unknown): number {
	if (exp instanceof Date) return exp.getTime();
	if (typeof exp === "number" && Number.isFinite(exp)) return exp;
	if (typeof exp === "string") {
		const d = new Date(exp);
		return Number.isNaN(d.getTime()) ? NaN : d.getTime();
	}
	return NaN;
}

/**
 * Richiede `Authorization: Bearer <sessionId>` oppure header `x-session-id`.
 * Valida riga in `sessions` e imposta `ctx.auth`.
 */
export function requireAuth(): Middleware<unknown> {
	return async (ctx: ServerContext, next) => {
		const sid = sessionIdFromHeaders(ctx.headers);
		if (!sid) error("UNAUTHORIZED", "Session required");

		const rows = await db.sessions.find({ id: { $eq: sid } }, { limit: 1 });
		const sess = rows[0];
		if (!sess) error("UNAUTHORIZED", "Invalid session");

		if (sess.revokedAt != null) error("UNAUTHORIZED", "Session revoked");

		const expMs = expiresAtMs(sess.expiresAt);
		if (!Number.isFinite(expMs) || expMs < Date.now()) error("UNAUTHORIZED", "Session expired");

		ctx.auth = {
			userId: sess.userId as string,
			sessionId: sess.id,
		};
		return next();
	};
}
