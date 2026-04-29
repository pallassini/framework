import { db } from "db";
import { error } from "../error";
import type { ServerContext } from "../routes/context";
import type { UserRole } from "./logic/route-config";
import type { Middleware } from "./logic/types";

/** Dopo `requireAuth`: il ruolo della sessione deve essere uno di `allowed` (prima di `applyUserTenantScope`). */
export function requireRole(allowed: UserRole | readonly UserRole[]): Middleware<unknown> {
	const set = new Set<UserRole>(Array.isArray(allowed) ? allowed : [allowed]);
	return async (ctx: ServerContext, next) => {
		const uid = ctx.user?.id;
		if (!uid) error("UNAUTHORIZED", "auth required");
		const row = (await db.users.find({ where: { id: uid } }))[0];
		if (!row || !set.has(row.role)) error("FORBIDDEN", "role not allowed");
		return next();
	};
}
