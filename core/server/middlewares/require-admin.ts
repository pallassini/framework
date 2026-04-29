import { db } from "db";
import { error } from "../error";
import type { ServerContext } from "../routes/context";
import type { Middleware } from "./logic/types";

/** Dopo `requireAuth`: solo utenti con `role === "admin"` (tabella `users`). */
export function requireAdmin(): Middleware<unknown> {
	return async (ctx: ServerContext, next) => {
		const uid = ctx.user?.id;
		if (!uid) error("UNAUTHORIZED", "auth required");
		const row = (await db.users.find({ where: { id: uid } }))[0];
		if (!row || row.role !== "admin") error("FORBIDDEN", "admin only");
		return next();
	};
}
