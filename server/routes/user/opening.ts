import { db } from "db";
import { error, s, v } from "server";
import { assertItem, assertResource, OMIT_CREATE_ROW_KEYS, stripUserId } from "./guards";

const openingCreate = db.openingHours.omit(...OMIT_CREATE_ROW_KEYS);

export const create = s({
	auth: true,
	input: v.oneOrArray(openingCreate),
	run: async (input, ctx) => {
		const list = Array.isArray(input) ? input : [input];
		for (const r of list) {
			if (r.startTime >= r.endTime) error("INPUT", "startTime deve precedere endTime");
			await assertResource(ctx.user!.id, r.resourceId);
			if (r.itemId != null) await assertItem(ctx.user!.id, r.itemId);
		}
		return { openingHours: await db.openingHours.create(list.map((r) => ({ ...r, userId: ctx.user!.id }))) };
	},
});

export const update = s({
	auth: true,
	input: db.openingHours.partial({ with: { id: v.string() }, min: 1 }),
	run: async (input, ctx) => {
		const { id, ...patch } = stripUserId(input);
		if (patch.resourceId !== undefined) await assertResource(ctx.user!.id, patch.resourceId);
		if (patch.itemId !== undefined && patch.itemId != null) await assertItem(ctx.user!.id, patch.itemId);
		const res = await db.openingHours.update({ where: { id, userId: ctx.user!.id }, set: patch });
		if (res.count === 0) error("NOT_FOUND", `openingHour ${id}`);
		return { openingHour: res.rows[0]! };
	},
});

export const remove = s({
	auth: true,
	input: v.object({ id: v.string() }),
	run: async ({ id }, ctx) => {
		const res = await db.openingHours.delete({ where: { id, userId: ctx.user!.id } });
		if (res.count === 0) error("NOT_FOUND", `openingHour ${id}`);
		return { ok: true };
	},
});

export const get = s({
	auth: true,
	input: v.object({
		resourceId: v.string().optional(),
		itemId: v.string().optional(),
	}),
	run: async ({ resourceId, itemId }, ctx) => {
		const base = { userId: ctx.user!.id };
		if (itemId) {
			const rows = await db.openingHours.find({ where: { ...base, itemId } });
			return { openingHours: rows };
		}
		if (resourceId) {
			const rows = await db.openingHours.find({ where: { ...base, resourceId } });
			return { openingHours: rows };
		}
		return { openingHours: await db.openingHours.find({ where: base }) };
	},
});
