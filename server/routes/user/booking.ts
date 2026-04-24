import { db } from "db";
import { error, s, v } from "server";
import { assertItem, assertResources, stripUserId, uid } from "./guards";

function validateRange(startAt: Date, endAt: Date) {
	if (endAt.getTime() <= startAt.getTime()) {
		error("INPUT", "endAt deve essere dopo startAt");
	}
}

export const bookingCreate = s({
	auth: true,
	input: v.array(db.bookings),
	run: async (input, ctx) => {
		const t = uid(ctx);
		for (const r of input) {
			validateRange(r.startAt, r.endAt);
			for (const line of r.items) {
				await assertItem(t, line.itemId);
			}
			if (r.assignments?.length) await assertResources(t, r.assignments);
		}
		return {
			bookings: await db.bookings.create(
				input.map((r) => ({
					...r,
					userId: t,
				})),
			),
		};
	},
});

export const bookingUpdate = s({
	auth: true,
	input: db.bookings.partial({ with: { id: v.string() }, min: 1 }),
	run: async (input, ctx) => {
		const t = uid(ctx);
		const { id, ...patch } = stripUserId(input);
		const existing = await db.bookings.find({ where: { id, userId: t } });
		if (existing.length === 0) error("NOT_FOUND", `booking ${id}`);
		const prev = existing[0]!;
		const next = { ...prev, ...patch };
		validateRange(next.startAt, next.endAt);
		if (patch.items) {
			for (const line of patch.items) {
				await assertItem(t, line.itemId);
			}
		}
		if (patch.assignments) await assertResources(t, patch.assignments);
		const res = await db.bookings.update({ where: { id, userId: t }, set: patch });
		if (res.count === 0) error("NOT_FOUND", `booking ${id}`);
		return { booking: res.rows[0]! };
	},
});

export const bookingCancel = s({
	auth: true,
	input: v.object({ id: v.string() }),
	run: async ({ id }, ctx) => {
		const t = uid(ctx);
		const res = await db.bookings.update({ where: { id, userId: t }, set: { status: "cancelled" } });
		if (res.count === 0) error("NOT_FOUND", `booking ${id}`);
		return { booking: res.rows[0]! };
	},
});

export const bookingDelete = s({
	auth: true,
	input: v.object({ id: v.string() }),
	run: async ({ id }, ctx) => {
		const t = uid(ctx);
		const res = await db.bookings.delete({ where: { id, userId: t } });
		if (res.count === 0) error("NOT_FOUND", `booking ${id}`);
		return { ok: true };
	},
});

export const bookingList = s({
	auth: true,
	input: v.object({
		from: v.datetime().optional(),
		to: v.datetime().optional(),
		status: db.bookings.status.optional(),
		resourceId: v.string().optional(),
		customerId: v.string().optional(),
	}),
	run: async ({ from, to, status, resourceId, customerId }, ctx) => {
		const t = uid(ctx);
		const where: Record<string, unknown> = { userId: t };
		if (status) where.status = status;
		if (customerId) where.customerId = customerId;
		if (from) where.startAt = { ...(where.startAt as object | undefined), $gte: from };
		if (to) where.endAt = { ...(where.endAt as object | undefined), $lte: to };
		const rows = await db.bookings.find({ where });
		const filtered = resourceId ? rows.filter((b) => b.assignments?.includes(resourceId)) : rows;
		return { bookings: filtered };
	},
});
