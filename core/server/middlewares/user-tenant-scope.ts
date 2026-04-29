import { db } from "db";
import { error } from "../error";
import type { ServerContext } from "../routes/context";
import type { Middleware } from "./logic/types";

function rpcUserLabel(u: { id: string; username?: string | null; email?: string | null }): string {
	const name = u.username?.trim();
	if (name) return name;
	const em = u.email?.trim();
	if (em) {
		const at = em.indexOf("@");
		return at > 0 ? em.slice(0, at) : em;
	}
	return u.id.slice(0, 8);
}

/**
 * Dopo `requireAuth`: solo per RPC il cui nome inizia con `user.`, se l’attore è `admin` e
 * c’è `x-target-user-id`, sostituisce `ctx.user.id` con l’id del tenant (role `user`).
 * Altre route (`admin.*`, `auth.*`, …) non vengono modificate.
 */
export function applyUserTenantScope(): Middleware<unknown> {
	return async (ctx: ServerContext, next) => {
		if (!ctx.routeName.startsWith("user.")) return next();

		const actorId = ctx.user?.id;
		if (!actorId) error("UNAUTHORIZED", "auth required");

		const actor = (await db.users.find({ where: { id: actorId } }))[0];
		if (!actor) error("UNAUTHORIZED", "user not found");

		const requested = ctx.headers.get("x-target-user-id")?.trim();
		if (actor.role !== "admin") {
			if (requested && requested !== actorId) error("FORBIDDEN", "only admin can target another user");
			return next();
		}

		if (!requested) return next();

		const target = (await db.users.find({ where: { id: requested } }))[0];
		if (!target) error("NOT_FOUND", `target user ${requested}`);
		if (target.role !== "user") error("FORBIDDEN", "admin can target only role=user");

		ctx.user = { id: target.id };
		const tenantL = rpcUserLabel(target);
		ctx.rpcLogParts.push(`admin control → ${tenantL}`);
		return next();
	};
}
