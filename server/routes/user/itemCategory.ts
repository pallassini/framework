import { db } from "db";
import { error, s, v } from "server";
import { OMIT_CREATE_ROW_KEYS, stripUserId } from "./guards";

const itemCategoryCreate = db.itemCategories.omit(...OMIT_CREATE_ROW_KEYS);

export const create = s({
	auth: true,
	input: v.oneOrArray(itemCategoryCreate),
	run: async (input, ctx) => {
		const list = Array.isArray(input) ? input : [input];
		const rows = list.map((r) => ({ ...r, userId: ctx.user!.id }));
		return { itemCategories: await db.itemCategories.create(rows) };
	},
});

export const update = s({
	auth: true,
	input: db.itemCategories.partial({ with: { id: v.string() }, min: 1 }),
	run: async (input, ctx) => {
		const { id, ...patch } = stripUserId(input);
		const res = await db.itemCategories.update({ where: { id, userId: ctx.user!.id }, set: patch });
		if (res.count === 0) error("NOT_FOUND", `itemCategory ${id}`);
		return { itemCategory: res.rows[0]! };
	},
});

export const remove = s({
	auth: true,
	input: v.object({ id: v.string() }),
	run: async ({ id }, ctx) => {
		const res = await db.itemCategories.delete({ where: { id, userId: ctx.user!.id } });
		if (res.count === 0) error("NOT_FOUND", `itemCategory ${id}`);
		return { ok: true };
	},
});

export const get = s({
	auth: true,
	run: async (ctx) => {
		return await db.itemCategories.find({ where: { userId: ctx.user!.id } });
	},
});
