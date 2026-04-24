import { db } from "db";
import { error, s, v } from "server";
import { assertResource, stripUserId } from "./guards";

export const create = s({
	auth: true,
	input: v.array(db.closures),
	run: async (input, ctx) => {
		for (const r of input) {
			if (r.endAt.getTime() <= r.startAt.getTime()) {
				error("INPUT", "endAt deve essere dopo startAt");
			}
			await assertResource(ctx.user!.id, r.resourceId);
		}
		return { closures: await db.closures.create(input.map((r) => ({ ...r, userId: ctx.user!.id }))) };
	},
});

export const update = s({
	auth: true,
	input: db.closures.partial({ with: { id: v.string() }, min: 1 }),
	run: async (input, ctx) => {
		const { id, ...patch } = stripUserId(input);
		const rows = await db.closures.find({ where: { id, userId: ctx.user!.id } });
		if (rows.length === 0) error("NOT_FOUND", `closure ${id}`);
		const prev = rows[0]!;
		const next = { ...prev, ...patch };
		if (next.endAt.getTime() <= next.startAt.getTime()) {
			error("INPUT", "endAt deve essere dopo startAt");
		}
		if (patch.resourceId !== undefined) await assertResource(ctx.user!.id, patch.resourceId);
		const res = await db.closures.update({ where: { id, userId: ctx.user!.id }, set: patch });
		if (res.count === 0) error("NOT_FOUND", `closure ${id}`);
		return { closure: res.rows[0]! };
	},
});

export const remove = s({
	auth: true,
	input: v.object({ id: v.string() }),
	run: async ({ id }, ctx) => {
		const res = await db.closures.delete({ where: { id, userId: ctx.user!.id } });
		if (res.count === 0) error("NOT_FOUND", `closure ${id}`);
		return { ok: true };
	},
});

export const get = s({
	auth: true,
	input: v.object({ resourceId: v.string().optional() }),
	run: async ({ resourceId }, ctx) => {
		if (resourceId) {
			return { closures: await db.closures.find({ where: { userId: ctx.user!.id, resourceId } }) };
		}
		return { closures: await db.closures.find({ where: { userId: ctx.user!.id } }) };
	},
});
