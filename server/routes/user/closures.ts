import { db } from "db";
import { error, s, v } from "server";
import { assertResource, stripUserId, uid } from "./guards";

export const closureCreate = s({
	auth: true,
	input: v.array(db.closures),
	run: async (input, ctx) => {
		const t = uid(ctx);
		for (const r of input) {
			if (r.endAt.getTime() <= r.startAt.getTime()) {
				error("INPUT", "endAt deve essere dopo startAt");
			}
			await assertResource(t, r.resourceId);
		}
		return { closures: await db.closures.create(input.map((r) => ({ ...r, userId: t }))) };
	},
});

export const closureUpdate = s({
	auth: true,
	input: db.closures.partial({ with: { id: v.string() }, min: 1 }),
	run: async (input, ctx) => {
		const t = uid(ctx);
		const { id, ...patch } = stripUserId(input);
		const rows = await db.closures.find({ where: { id, userId: t } });
		if (rows.length === 0) error("NOT_FOUND", `closure ${id}`);
		const prev = rows[0]!;
		const next = { ...prev, ...patch };
		if (next.endAt.getTime() <= next.startAt.getTime()) {
			error("INPUT", "endAt deve essere dopo startAt");
		}
		if (patch.resourceId !== undefined) await assertResource(t, patch.resourceId);
		const res = await db.closures.update({ where: { id, userId: t }, set: patch });
		if (res.count === 0) error("NOT_FOUND", `closure ${id}`);
		return { closure: res.rows[0]! };
	},
});

export const closureDelete = s({
	auth: true,
	input: v.object({ id: v.string() }),
	run: async ({ id }, ctx) => {
		const t = uid(ctx);
		const res = await db.closures.delete({ where: { id, userId: t } });
		if (res.count === 0) error("NOT_FOUND", `closure ${id}`);
		return { ok: true };
	},
});

export const closureList = s({
	auth: true,
	input: v.object({ resourceId: v.string().optional() }),
	run: async ({ resourceId }, ctx) => {
		const t = uid(ctx);
		if (resourceId) {
			return { closures: await db.closures.find({ where: { userId: t, resourceId } }) };
		}
		return { closures: await db.closures.find({ where: { userId: t } }) };
	},
});
