import { db } from "db";
import { error, s, v } from "server";
import { stripUserId } from "./guards";

const resourceInput = v.object({
	name: v.string(),
	capacity: v.number(),
	type: v.enum(["space", "person"]),
});

export const create = s({
	auth: true,
	input: v.oneOrArray(resourceInput),
	run: async (input, ctx) => {
		const list = Array.isArray(input) ? input : [input];
		return {
			resources: await db.resources.create(
				list.map((r) => ({ ...r, userId: ctx.user!.id })),
			),
		};
	},
});

export const update = s({
	auth: true,
	input: db.resources.partial({ with: { id: v.string() }, min: 1 }),
	run: async (input, ctx) => {
		const { id, ...patch } = stripUserId(input);
		const res = await db.resources.update({ where: { id, userId: ctx.user!.id }, set: patch });
		if (res.count === 0) error("NOT_FOUND", `resource ${id}`);
		return { resource: res.rows[0]! };
	},
});

export const remove = s({
	auth: true,
	input: v.object({ id: v.string() }),
	run: async ({ id }, ctx) => {
		const res = await db.resources.delete({ where: { id, userId: ctx.user!.id } });
		if (res.count === 0) error("NOT_FOUND", `resource ${id}`);
		return { ok: true };
	},
});

export const get = s({
	auth: true,
	run: async (ctx) => {
		const rows = await db.resources.find({ where: { userId: ctx.user!.id } });
		const resources = rows.map((r) => ({ ...r, capacity: r.capacity ?? 1 }));
		return {
			resources,
			space: resources.filter((r) => r.type === "space"),
			person: resources.filter((r) => r.type === "person"),
		};
	},
});
