import { v } from "../core/client/validator";
import { table } from "../core/db/schema/table";
export const users = table({
	email: v.string(),
	name: v.string(),
	role: v.optional(v.string()),
});

export const works = table({
	title: v.string(),
	authorId: "users",
});

export const works99jd = table({
	title: v.string(),
	authorId: "users",
});