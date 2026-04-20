import { db } from "db";
import { error, s, v } from "server";

// ─── ADMIN BOOTSTRAP ─────────────────────────────────────────────────────────

/**
 * Carica in un'unica chiamata tutto ciò che serve alla dashboard admin al boot.
 * Esclusi i `bookings` (troppi nel tempo): usare `bookingList({ from, to })` per range.
 */
export const getAllAdmin = s({
	run: async () => {
		const [itemCategories, items, resources, openingHours, closures] = await Promise.all([
			db.itemCategories.find(),
			db.items.find(),
			db.resources.find(),
			db.openingHours.find(),
			db.closures.find(),
		]);
		return { itemCategories, items, resources, openingHours, closures };
	},
});

// ─── ITEM CATEGORY ───────────────────────────────────────────────────────────

export const itemCategoryCreate = s({
	input: v.array(db.itemCategories),
	run: async (input) => ({ itemCategories: await db.itemCategories.create(input) }),
});

export const itemCategoryUpdate = s({
	input: db.itemCategories.partial({ with: { id: v.string() }, min: 1 }),
	run: async ({ id, ...patch }) => {
		const res = await db.itemCategories.update({ where: { id }, set: patch });
		if (res.count === 0) error("NOT_FOUND", `itemCategory ${id}`);
		return { itemCategory: res.rows[0]! };
	},
});

export const itemCategoryDelete = s({
	input: v.object({ id: v.string() }),
	run: async ({ id }) => {
		const res = await db.itemCategories.delete({ where: { id } });
		if (res.count === 0) error("NOT_FOUND", `itemCategory ${id}`);
		return { ok: true };
	},
});

export const itemCategoryList = s({
	run: async () => ({ itemCategories: await db.itemCategories.find() }),
});

// ─── ITEM ────────────────────────────────────────────────────────────────────

export const itemCreate = s({
	input: v.array(db.items),
	run: async (input) => ({ items: await db.items.create(input) }),
});

export const itemUpdate = s({
	input: db.items.partial({ with: { id: v.string() }, min: 1 }),
	run: async ({ id, ...patch }) => {
		const res = await db.items.update({ where: { id }, set: patch });
		if (res.count === 0) error("NOT_FOUND", `item ${id}`);
		return { item: res.rows[0]! };
	},
});

export const itemDelete = s({
	input: v.object({ id: v.string() }),
	run: async ({ id }) => {
		const res = await db.items.delete({ where: { id } });
		if (res.count === 0) error("NOT_FOUND", `item ${id}`);
		return { ok: true };
	},
});

export const itemList = s({
	input: v.object({
		categoryId: v.string().optional(),
		includeArchived: v.boolean().optional(),
	}),
	run: async ({ categoryId, includeArchived }) => {
		const where: Record<string, unknown> = {};
		if (categoryId) where.categoryId = categoryId;
		if (!includeArchived) where.active = true;
		return { items: await db.items.find({ where }) };
	},
});

// ─── RESOURCE ────────────────────────────────────────────────────────────────

export const resourceCreate = s({
	input: v.array(db.resources),
	run: async (input) => ({ resources: await db.resources.create(input) }),
});

export const resourceUpdate = s({
	input: db.resources.partial({ with: { id: v.string() }, min: 1 }),
	run: async ({ id, ...patch }) => {
		const res = await db.resources.update({ where: { id }, set: patch });
		if (res.count === 0) error("NOT_FOUND", `resource ${id}`);
		return { resource: res.rows[0]! };
	},
});

export const resourceDelete = s({
	input: v.object({ id: v.string() }),
	run: async ({ id }) => {
		const res = await db.resources.delete({ where: { id } });
		if (res.count === 0) error("NOT_FOUND", `resource ${id}`);
		return { ok: true };
	},
});

export const resourceList = s({
	input: v.object({ includeArchived: v.boolean().optional() }),
	run: async ({ includeArchived }) => ({
		resources: await db.resources.find({ where: includeArchived ? {} : { active: true } }),
	}),
});

// ─── OPENING HOUR ────────────────────────────────────────────────────────────

export const openingHourCreate = s({
	input: v.array(db.openingHours),
	run: async (input) => {
		for (const r of input) {
			if (r.startTime >= r.endTime) error("INPUT", "startTime deve precedere endTime");
		}
		return { openingHours: await db.openingHours.create(input) };
	},
});

export const openingHourUpdate = s({
	input: db.openingHours.partial({ with: { id: v.string() }, min: 1 }),
	run: async ({ id, ...patch }) => {
		const res = await db.openingHours.update({ where: { id }, set: patch });
		if (res.count === 0) error("NOT_FOUND", `openingHour ${id}`);
		return { openingHour: res.rows[0]! };
	},
});

export const openingHourDelete = s({
	input: v.object({ id: v.string() }),
	run: async ({ id }) => {
		const res = await db.openingHours.delete({ where: { id } });
		if (res.count === 0) error("NOT_FOUND", `openingHour ${id}`);
		return { ok: true };
	},
});

export const openingHourList = s({
	input: v.object({ resourceId: v.string().optional() }),
	run: async ({ resourceId }) => ({
		openingHours: await db.openingHours.find(resourceId ? { resourceId } : undefined),
	}),
});

// ─── CLOSURE ─────────────────────────────────────────────────────────────────

export const closureCreate = s({
	input: v.array(db.closures),
	run: async (input) => {
		for (const r of input) {
			if (r.endAt.getTime() <= r.startAt.getTime()) {
				error("INPUT", "endAt deve essere dopo startAt");
			}
		}
		return { closures: await db.closures.create(input) };
	},
});

export const closureUpdate = s({
	input: db.closures.partial({ with: { id: v.string() }, min: 1 }),
	run: async ({ id, ...patch }) => {
		const res = await db.closures.update({ where: { id }, set: patch });
		if (res.count === 0) error("NOT_FOUND", `closure ${id}`);
		return { closure: res.rows[0]! };
	},
});

export const closureDelete = s({
	input: v.object({ id: v.string() }),
	run: async ({ id }) => {
		const res = await db.closures.delete({ where: { id } });
		if (res.count === 0) error("NOT_FOUND", `closure ${id}`);
		return { ok: true };
	},
});

export const closureList = s({
	input: v.object({ resourceId: v.string().optional() }),
	run: async ({ resourceId }) => ({
		closures: await db.closures.find(resourceId ? { resourceId } : undefined),
	}),
});

// ─── BOOKING ─────────────────────────────────────────────────────────────────

export const bookingCreate = s({
	input: v.array(db.bookings),
	run: async (input) => {
		for (const r of input) {
			if (r.endAt.getTime() <= r.startAt.getTime()) {
				error("INPUT", "endAt deve essere dopo startAt");
			}
		}
		return { bookings: await db.bookings.create(input) };
	},
});

export const bookingUpdate = s({
	input: db.bookings.partial({ with: { id: v.string() }, min: 1 }),
	run: async ({ id, ...patch }) => {
		const res = await db.bookings.update({ where: { id }, set: patch });
		if (res.count === 0) error("NOT_FOUND", `booking ${id}`);
		return { booking: res.rows[0]! };
	},
});

export const bookingCancel = s({
	input: v.object({ id: v.string() }),
	run: async ({ id }) => {
		const res = await db.bookings.update({ where: { id }, set: { status: "cancelled" } });
		if (res.count === 0) error("NOT_FOUND", `booking ${id}`);
		return { booking: res.rows[0]! };
	},
});

export const bookingDelete = s({
	input: v.object({ id: v.string() }),
	run: async ({ id }) => {
		const res = await db.bookings.delete({ where: { id } });
		if (res.count === 0) error("NOT_FOUND", `booking ${id}`);
		return { ok: true };
	},
});

export const bookingList = s({
	input: v.object({
		from: v.datetime().optional(),
		to: v.datetime().optional(),
		status: db.bookings.status.optional(),
		resourceId: v.string().optional(),
		customerId: v.string().optional(),
	}),
	run: async ({ from, to, status, resourceId, customerId }) => {
		const where: Record<string, unknown> = {};
		if (status) where.status = status;
		if (customerId) where.customerId = customerId;
		if (from) where.startAt = { ...(where.startAt as object | undefined), $gte: from };
		if (to) where.endAt = { ...(where.endAt as object | undefined), $lte: to };
		const rows = await db.bookings.find({ where });
		const filtered = resourceId
			? rows.filter((b) => b.assignments?.includes(resourceId))
			: rows;
		return { bookings: filtered };
	},
});
