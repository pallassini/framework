/**
 * Modello dati: **un export const per tabella** (`users`, `works`, …).
 * Ogni tabella = `defineTable` + `v.object` (form, validazione server, inferenza tipi).
 * `bun run db push` raccoglie tutti gli export che sono tabelle e scrive `catalog.json`.
 */
import { v } from "../core/client/validator";
import type { InferSchema } from "../core/client/validator/properties/defs";
import { bundleTables, defineTable } from "../core/db/schema/table";

export const users = defineTable(
	"users",
	v.object({
		id: v.string(),
		email: v.string(),
		name: v.string(),
		role: v.optional(v.string()),
	}),
	{ unique: ["email"] },
);

export const works = defineTable(
	"works",
	v.object({
		id: v.string(),
		title: v.string(),
		authorId: v.string(),
	}),
	{
		fk: { authorId: { ref: "users", onDelete: "cascade" } },
	},
);

export type User = InferSchema<typeof users.row>;
export type Work = InferSchema<typeof works.row>;

export type ServerTables = {
	users: User;
	works: Work;
};

const merged = bundleTables([users, works]);

export default merged;
