import { describe, expect, test } from "bun:test";
import { createDb, f, w } from "./orm";

type User = { id: string; name: string; score: number };
type Order = { id: string; userId: string; total: number };

describe("orm namespace + table", () => {
	test("folder nesting profondo e path stabile", () => {
		const db = createDb();
		const ns = db
			.folder("tenant")
			.folder("eu")
			.folder("prod")
			.folder("v2");
		expect(ns.path).toBe("/tenant/eu/prod/v2");
		const users = ns.table<User>("users");
		expect(users.fullPath).toBe("/tenant/eu/prod/v2/users");
	});

	test("CRUD + where fluente", async () => {
		const db = createDb();
		const users = db.folder("acme").table<User>("users");

		const a = await users.insert({ name: "Ada", score: 10 });
		const b = await users.insert({ name: "Bob", score: 20 });
		expect(a.id).toBeDefined();
		expect(b.id).toBeDefined();

		const n = await users.update(w(f("id").eq(a.id)), { score: 99 });
		expect(n).toBe(1);

		const hi = await users.findMany({
			where: w(f("score").gte(50)),
			limit: 10,
		});
		expect(hi.length).toBe(1);
		expect(hi[0]!.name).toBe("Ada");

		const deleted = await users.delete({ id: b.id });
		expect(deleted).toBe(1);
		const rest = await users.findMany();
		expect(rest.length).toBe(1);
	});

	test("shorthand where object", async () => {
		const db = createDb();
		const orders = db.folder("shop").table<Order>("orders");
		const u = await orders.insert({ userId: "u1", total: 100 });
		const found = await orders.findFirst({ where: { userId: "u1" } });
		expect(found?.id).toBe(u.id);
	});

	test("segmento invalido rifiutato", () => {
		const db = createDb();
		expect(() => db.folder("bad/name")).toThrow();
	});
});
