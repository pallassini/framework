import { db } from "db";
import { error, s, v } from "server";
import { assertItem, assertItemCategory, assertResources, stripUserId, uid } from "./guards";

export const itemCategoryCreate = s({
	auth: true,
	input: v.array(db.itemCategories),
	run: async (input, ctx) => {
		const t = uid(ctx);
		const rows = input.map((r) => ({ ...r, userId: t }));
		return { itemCategories: await db.itemCategories.create(rows) };
	},
});

export const itemCategoryUpdate = s({
	auth: true,
	input: db.itemCategories.partial({ with: { id: v.string() }, min: 1 }),
	run: async (input, ctx) => {
		const t = uid(ctx);
		const { id, ...patch } = stripUserId(input);
		const res = await db.itemCategories.update({ where: { id, userId: t }, set: patch });
		if (res.count === 0) error("NOT_FOUND", `itemCategory ${id}`);
		return { itemCategory: res.rows[0]! };
	},
});

export const itemCategoryDelete = s({
	auth: true,
	input: v.object({ id: v.string() }),
	run: async ({ id }, ctx) => {
		const t = uid(ctx);
		const res = await db.itemCategories.delete({ where: { id, userId: t } });
		if (res.count === 0) error("NOT_FOUND", `itemCategory ${id}`);
		return { ok: true };
	},
});

export const itemCategoryList = s({
	auth: true,
	run: async (ctx) => {
		const t = uid(ctx);
		return { itemCategories: await db.itemCategories.find({ where: { userId: t } }) };
	},
});

export const itemCreate = s({
	auth: true,
	input: v.array(db.items),
	run: async (input, ctx) => {
		const t = uid(ctx);
		for (const r of input) {
			await assertItemCategory(t, r.categoryId);
			await assertResources(t, r.resources);
			if (r.relations) for (const rel of r.relations) await assertItem(t, rel.itemId);
		}
		const rows = input.map((r) => ({ ...r, userId: t }));
		return { items: await db.items.create(rows) };
	},
});

export const itemUpdate = s({
	auth: true,
	input: db.items.partial({ with: { id: v.string() }, min: 1 }),
	run: async (input, ctx) => {
		const t = uid(ctx);
		const { id, ...patch } = stripUserId(input);
		if (patch.categoryId !== undefined) await assertItemCategory(t, patch.categoryId);
		if (patch.resources !== undefined) await assertResources(t, patch.resources);
		if (patch.relations) for (const rel of patch.relations) await assertItem(t, rel.itemId);
		const res = await db.items.update({ where: { id, userId: t }, set: patch });
		if (res.count === 0) error("NOT_FOUND", `item ${id}`);
		return { item: res.rows[0]! };
	},
});

export const itemDelete = s({
	auth: true,
	input: v.object({ id: v.string() }),
	run: async ({ id }, ctx) => {
		const t = uid(ctx);
		const res = await db.items.delete({ where: { id, userId: t } });
		if (res.count === 0) error("NOT_FOUND", `item ${id}`);
		return { ok: true };
	},
});

export const itemList = s({
	auth: true,
	input: v.object({
		categoryId: v.string().optional(),
		includeArchived: v.boolean().optional(),
	}),
	run: async ({ categoryId, includeArchived }, ctx) => {
		const t = uid(ctx);
		const where: Record<string, unknown> = { userId: t };
		if (categoryId) where.categoryId = categoryId;
		if (!includeArchived) where.deletedAt = null;
		return { items: await db.items.find({ where }) };
	},
});
