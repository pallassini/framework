import { s, v } from "server";
import { db, dbCustomBackend } from "db";
import { ValidationError, type InputSchema } from "../../core/client/validator/properties/defs";

export type DbRequest =
	| { op: "probe" }
	| { op: "users.list" }
	| {
			op: "users.create";
			payload: { email?: string; password?: string; username?: string; role?: "admin" | "user" };
	  }
	| { op: "users.update"; id: string; patch: { email?: string; password?: string; username?: string; role?: "admin" | "user" } }
	| { op: "users.delete"; id: string };

function looseUserFields(p: Record<string, unknown>): {
	email?: string;
	password?: string;
	username?: string;
	role?: "admin" | "user";
} {
	const roleRaw = p.role;
	const role: "admin" | "user" | undefined =
		roleRaw === "admin" || roleRaw === "user" ? roleRaw : undefined;
	return {
		email: typeof p.email === "string" ? p.email : undefined,
		password: typeof p.password === "string" ? p.password : undefined,
		username: typeof p.username === "string" ? p.username : undefined,
		role,
	};
}

const dbInputSchema: InputSchema<DbRequest> = {
	parse(raw) {
		if (typeof raw !== "object" || raw === null) throw new ValidationError("expected object");
		const o = raw as Record<string, unknown>;
		switch (o.op) {
			case "probe":
				return { op: "probe" };
			case "users.list":
				return { op: "users.list" };
			case "users.create": {
				const payload = o.payload;
				if (typeof payload !== "object" || payload === null) throw new ValidationError("users.create: payload");
				return { op: "users.create", payload: looseUserFields(payload as Record<string, unknown>) };
			}
			case "users.update": {
				if (typeof o.id !== "string" || !o.id) throw new ValidationError("users.update: id");
				const patch = o.patch;
				if (typeof patch !== "object" || patch === null) throw new ValidationError("users.update: patch");
				return {
					op: "users.update",
					id: o.id,
					patch: looseUserFields(patch as Record<string, unknown>),
				};
			}
			case "users.delete": {
				if (typeof o.id !== "string" || !o.id) throw new ValidationError("users.delete: id");
				return { op: "users.delete", id: o.id };
			}
			default:
				throw new ValidationError(`unknown op: ${String(o.op)}`);
		}
	},
};

async function runProbe() {
	try {
		const users = await db.users.find();
		const userCount = await db.users.count();
		return { ok: true as const, op: "probe" as const, backend: dbCustomBackend, users, userCount };
	} catch (e) {
		return {
			ok: false as const,
			op: "probe" as const,
			error: e instanceof Error ? e.message : String(e),
		};
	}
}

export default s({
	input: dbInputSchema,
	run: async (input, _ctx) => {
		switch (input.op) {
			case "probe":
				return runProbe();
			case "users.list":
				return { ok: true as const, op: input.op, users: await db.users.find() };
			case "users.create": {
				const { email = "", password = "", username, role = "user" } = input.payload;
				const rows = await db.users.create({ email, password, username, role });
				return { ok: true as const, op: input.op, rows };
			}
			case "users.update": {
				const res = await db.users.update({ id: { $eq: input.id } }, input.patch);
				return { ok: true as const, op: input.op, ...res };
			}
			case "users.delete": {
				const res = await db.users.delete({ id: { $eq: input.id } });
				return { ok: true as const, op: input.op, ...res };
			}
		}
	},
});

export const rowUpdate = s({
	input: v.object({
		table: db,
		id: v.string(),
		field: v.string(),
		value: v.unknown(),
	}),
	run: async (inp, _ctx) => {
		await db.table(inp.table).update(
			{ id: inp.id } as never,
			{ [inp.field]: inp.value } as never,
		);
		return { ok: true as const };
	},
});

export const rowDelete = s({
	input: v.object({ table: db, id: v.string() }),
	run: async (inp, _ctx) => {
		await db.table(inp.table).delete({ id: inp.id } as never);
		return { ok: true as const };
	},
});
