import { db } from "db";
import { error, s, v } from "server";
import { assertItem, assertResources, OMIT_CREATE_ROW_KEYS, stripUserId } from "./guards";

function validateRange(startAt: Date, endAt: Date) {
	if (endAt.getTime() <= startAt.getTime()) {
		error("INPUT", "endAt deve essere dopo startAt");
	}
}

const bookingCreate = db.bookings.omit(...OMIT_CREATE_ROW_KEYS);

export const create = s({
	auth: true,
	input: v.oneOrArray(bookingCreate),
	run: async (input, ctx) => {
		const list = Array.isArray(input) ? input : [input];
		for (const r of list) {
			validateRange(r.startAt, r.endAt);
			for (const line of r.items) {
				await assertItem(ctx.user!.id, line.itemId);
			}
			if (r.assignments?.length) await assertResources(ctx.user!.id, r.assignments);
		}
		return {
			bookings: await db.bookings.create(
				list.map((r) => ({
					...r,
					userId: ctx.user!.id,
				})),
			),
		};
	},
});

export const update = s({
	auth: true,
	input: db.bookings.partial({ with: { id: v.string() }, min: 1 }),
	run: async (input, ctx) => {
		const { id, ...patch } = stripUserId(input);
		const existing = await db.bookings.find({ where: { id, userId: ctx.user!.id } });
		if (existing.length === 0) error("NOT_FOUND", `booking ${id}`);
		const prev = existing[0]!;
		const next = { ...prev, ...patch };
		validateRange(next.startAt, next.endAt);
		if (patch.items) {
			for (const line of patch.items) {
				await assertItem(ctx.user!.id, line.itemId);
			}
		}
		if (patch.assignments) await assertResources(ctx.user!.id, patch.assignments);
		const res = await db.bookings.update({ where: { id, userId: ctx.user!.id }, set: patch });
		if (res.count === 0) error("NOT_FOUND", `booking ${id}`);
		return { booking: res.rows[0]! };
	},
});

export const cancel = s({
	auth: true,
	input: v.object({ id: v.string() }),
	run: async ({ id }, ctx) => {
		const res = await db.bookings.update({ where: { id, userId: ctx.user!.id }, set: { status: "cancelled" } });
		if (res.count === 0) error("NOT_FOUND", `booking ${id}`);
		return { booking: res.rows[0]! };
	},
});

export const remove = s({
	auth: true,
	input: v.object({ id: v.string() }),
	run: async ({ id }, ctx) => {
		const res = await db.bookings.delete({ where: { id, userId: ctx.user!.id } });
		if (res.count === 0) error("NOT_FOUND", `booking ${id}`);
		return { ok: true };
	},
});

export const get = s({
	auth: true,
	input: v.object({
		from: v.datetime().optional(),
		to: v.datetime().optional(),
		status: db.bookings.status.optional(),
		resourceId: v.string().optional(),
		customerId: v.string().optional(),
	}),
	run: async ({ from, to, status, resourceId, customerId }, ctx) => {
		const where: Record<string, unknown> = { userId: ctx.user!.id };
		if (status) where.status = status;
		if (customerId) where.customerId = customerId;
		if (from) where.startAt = { ...(where.startAt as object | undefined), $gte: from };
		if (to) where.endAt = { ...(where.endAt as object | undefined), $lte: to };
		const rows = await db.bookings.find({ where });
		const filtered = resourceId ? rows.filter((b) => b.assignments?.includes(resourceId)) : rows;
		return { bookings: filtered };
	},
});
