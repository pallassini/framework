import { db } from "db";
import { error, s, v } from "server";
import { assertItem, assertItemCategory, assertResources, stripUserId } from "./guards";

export const create = s({
	auth: true,
	input: v.array(db.items),
	run: async (input, ctx) => {
		for (const r of input) {
			await assertItemCategory(ctx.user!.id, r.categoryId);
			await assertResources(ctx.user!.id, r.resources);
			if (r.relations) for (const rel of r.relations) await assertItem(ctx.user!.id, rel.itemId);
		}
		const rows = input.map((r) => ({ ...r, userId: ctx.user!.id }));
		return { items: await db.items.create(rows) };
	},
});

export const update = s({
	auth: true,
	input: db.items.partial({ with: { id: v.string() }, min: 1 }),
	run: async (input, ctx) => {
		const { id, ...patch } = stripUserId(input);
		if (patch.categoryId !== undefined) await assertItemCategory(ctx.user!.id, patch.categoryId);
		if (patch.resources !== undefined) await assertResources(ctx.user!.id, patch.resources);
		if (patch.relations) for (const rel of patch.relations) await assertItem(ctx.user!.id, rel.itemId);
		const res = await db.items.update({ where: { id, userId: ctx.user!.id }, set: patch });
		if (res.count === 0) error("NOT_FOUND", `item ${id}`);
		return { item: res.rows[0]! };
	},
});

export const remove = s({
	auth: true,
	input: v.object({ id: v.string() }),
	run: async ({ id }, ctx) => {
		const res = await db.items.delete({ where: { id, userId: ctx.user!.id } });
		if (res.count === 0) error("NOT_FOUND", `item ${id}`);
		return { ok: true };
	},
});

export const get = s({
	auth: true,
	input: v.object({
		categoryId: v.string().optional(),
		includeArchived: v.boolean().optional(),
	}),
	run: async ({ categoryId, includeArchived }, ctx) => {
		const where: Record<string, unknown> = { userId: ctx.user!.id };
		if (categoryId) where.categoryId = categoryId;
		if (!includeArchived) where.deletedAt = null;
		return { items: await db.items.find({ where }) };
	},
});
