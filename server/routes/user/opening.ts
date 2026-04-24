import { db } from "db";
import { error, s, v } from "server";
import { assertResource, stripUserId, uid } from "./guards";

export const openingHourCreate = s({
	auth: true,
	input: v.array(db.openingHours),
	run: async (input, ctx) => {
		const t = uid(ctx);
		for (const r of input) {
			if (r.startTime >= r.endTime) error("INPUT", "startTime deve precedere endTime");
			await assertResource(t, r.resourceId);
		}
		return { openingHours: await db.openingHours.create(input.map((r) => ({ ...r, userId: t }))) };
	},
});

export const openingHourUpdate = s({
	auth: true,
	input: db.openingHours.partial({ with: { id: v.string() }, min: 1 }),
	run: async (input, ctx) => {
		const t = uid(ctx);
		const { id, ...patch } = stripUserId(input);
		if (patch.resourceId !== undefined) await assertResource(t, patch.resourceId);
		const res = await db.openingHours.update({ where: { id, userId: t }, set: patch });
		if (res.count === 0) error("NOT_FOUND", `openingHour ${id}`);
		return { openingHour: res.rows[0]! };
	},
});

export const openingHourDelete = s({
	auth: true,
	input: v.object({ id: v.string() }),
	run: async ({ id }, ctx) => {
		const t = uid(ctx);
		const res = await db.openingHours.delete({ where: { id, userId: t } });
		if (res.count === 0) error("NOT_FOUND", `openingHour ${id}`);
		return { ok: true };
	},
});

export const openingHourList = s({
	auth: true,
	input: v.object({ resourceId: v.string().optional() }),
	run: async ({ resourceId }, ctx) => {
		const t = uid(ctx);
		if (resourceId) {
			const rows = await db.openingHours.find({ where: { userId: t, resourceId } });
			return { openingHours: rows };
		}
		return { openingHours: await db.openingHours.find({ where: { userId: t } }) };
	},
});
