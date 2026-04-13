import { s } from "server";
import { db, dbCustomBackend } from "../../core/db";
import { ValidationError, type InputSchema } from "../../core/client/validator/properties/defs";
import type { ServerContext } from "../../core/server/routes/context";

export type DbRequest =
	| { op: "probe" }
	| { op: "users.list" }
	| { op: "users.create"; payload: { email?: string; name?: string; role?: string } }
	| { op: "users.update"; id: string; patch: { email?: string; name?: string; role?: string } }
	| { op: "users.delete"; id: string };

const dbInputSchema: InputSchema<DbRequest> = {
	parse(raw) {
		if (typeof raw !== "object" || raw === null) throw new ValidationError("expected object");
		const o = raw as Record<string, unknown>;
		const op = o.op;
		if (op === "probe") return { op: "probe" };
		if (op === "users.list") return { op: "users.list" };
		if (op === "users.create") {
			const payload = o.payload;
			if (typeof payload !== "object" || payload === null) throw new ValidationError("users.create: payload");
			const p = payload as Record<string, unknown>;
			return {
				op: "users.create",
				payload: {
					email: typeof p.email === "string" ? p.email : undefined,
					name: typeof p.name === "string" ? p.name : undefined,
					role: typeof p.role === "string" ? p.role : undefined,
				},
			};
		}
		if (op === "users.update") {
			if (typeof o.id !== "string" || !o.id) throw new ValidationError("users.update: id");
			const patch = o.patch;
			if (typeof patch !== "object" || patch === null) throw new ValidationError("users.update: patch");
			const p = patch as Record<string, unknown>;
			return {
				op: "users.update",
				id: o.id,
				patch: {
					email: typeof p.email === "string" ? p.email : undefined,
					name: typeof p.name === "string" ? p.name : undefined,
					role: typeof p.role === "string" ? p.role : undefined,
				},
			};
		}
		if (op === "users.delete") {
			if (typeof o.id !== "string" || !o.id) throw new ValidationError("users.delete: id");
			return { op: "users.delete", id: o.id };
		}
		throw new ValidationError(`unknown op: ${String(op)}`);
	},
};

async function runProbe() {
	try {
		const users = await db.users.find();
		const userCount = await db.users.count();
		return {
			ok: true as const,
			op: "probe" as const,
			backend: dbCustomBackend,
			users,
			userCount,
		};
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
	run: async (input: DbRequest, _ctx: ServerContext) => {
		switch (input.op) {
			case "probe":
				return runProbe();
			case "users.list": {
				const users = await db.users.find();
				return { ok: true as const, op: input.op, users };
			}
			case "users.create": {
				const created = await db.users.create({
					email: input.payload.email,
					name: input.payload.name,
					role: input.payload.role,
				});
				return { ok: true as const, op: input.op, rows: created };
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
