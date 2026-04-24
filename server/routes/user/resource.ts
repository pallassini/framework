import { db } from "db";
import { error, s, v } from "server";
import { stripUserId, uid } from "./guards";

export const resourceCreate = s({
	auth: true,
	input: v.array(db.resources),
	run: async (input, ctx) => {
		const t = uid(ctx);
		return { resources: await db.resources.create(input.map((r) => ({ ...r, userId: t }))) };
	},
});

export const resourceUpdate = s({
	auth: true,
	input: db.resources.partial({ with: { id: v.string() }, min: 1 }),
	run: async (input, ctx) => {
		const t = uid(ctx);
		const { id, ...patch } = stripUserId(input);
		const res = await db.resources.update({ where: { id, userId: t }, set: patch });
		if (res.count === 0) error("NOT_FOUND", `resource ${id}`);
		return { resource: res.rows[0]! };
	},
});

export const resourceDelete = s({
	auth: true,
	input: v.object({ id: v.string() }),
	run: async ({ id }, ctx) => {
		const t = uid(ctx);
		const res = await db.resources.delete({ where: { id, userId: t } });
		if (res.count === 0) error("NOT_FOUND", `resource ${id}`);
		return { ok: true };
	},
});

export const resourceList = s({
	auth: true,
	input: v.object({ includeArchived: v.boolean().optional() }),
	run: async ({ includeArchived }, ctx) => {
		const t = uid(ctx);
		const where: Record<string, unknown> = { userId: t };
		if (!includeArchived) where.deletedAt = null;
		return { resources: await db.resources.find({ where }) };
	},
});
