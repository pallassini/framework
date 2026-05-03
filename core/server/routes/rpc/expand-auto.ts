import { db } from "db";
import { v } from "../../../client/validator";
import { ValidationError, type InputSchema } from "../../../client/validator/properties/defs";
import { error } from "../../error";
import type { RouteAutoConfig, RouteInputConfig } from "../../middlewares/logic/route-config";
import type { ServerContext } from "../context";
import type { DbRow, TableAccessor } from "../../../db/core/types";

const AUTO_RE = /^([a-zA-Z][a-zA-Z0-9]*)\.(create|update|delete|remove|get)$/;

const OMIT_CREATE_BASE = ["id", "createdAt", "updatedAt", "deletedAt"] as const;

function tableNames(): Set<string> {
	return new Set(
		Object.keys(db.tables).filter((k) => k !== "$"),
	);
}

function getAccessor(name: string): TableAccessor<DbRow> {
	if (!tableNames().has(name)) {
		throw new Error(`[s.auto] tabella sconosciuta: ${name}`);
	}
	return (db.tables as unknown as Record<string, TableAccessor<DbRow>>)[name]!;
}

/** `users` non va scoped per `userId`; altre tabelle con colonna `userId` sì se l’auth prevede tenant (non solo admin). */
function tableUsesTenantUserId(table: string, acc: TableAccessor<DbRow>): boolean {
	if (table === "users") return false;
	return "userId" in (acc as object);
}

function autoUsesTenantScopedUserId(auth: RouteAutoConfig["auth"]): boolean {
	if (auth === undefined || auth === false || auth === "admin") return false;
	return true;
}

function stripUserId<T extends { userId?: string }>(patch: T): Omit<T, "userId"> {
	const { userId: _u, ...rest } = patch;
	return rest;
}

/** Input opzionale per `*.get`: `where` oppure campi diretti (unione in `find`). */
const AUTO_GET_INPUT: InputSchema<{ where?: Record<string, unknown> }> = {
	parse(raw) {
		if (raw === undefined || raw === null) return {};
		if (typeof raw !== "object" || Array.isArray(raw)) {
			throw new ValidationError("expected object");
		}
		const o = raw as Record<string, unknown>;
		let base: Record<string, unknown> = {};
		if (o.where !== undefined) {
			if (typeof o.where !== "object" || o.where === null || Array.isArray(o.where)) {
				throw new ValidationError("where: expected object");
			}
			base = { ...(o.where as Record<string, unknown>) };
		}
		const merged: Record<string, unknown> = { ...base };
		for (const [k, v] of Object.entries(o)) {
			if (k === "where") continue;
			if (v !== undefined) merged[k] = v;
		}
		if (Object.keys(merged).length === 0) return {};
		return { where: merged };
	},
};

function mergeAutoGetWhere(
	tenant: boolean,
	ctx: ServerContext,
	inp: { where?: Record<string, unknown> },
): Record<string, unknown> {
	const fromInput = inp.where ? { ...inp.where } : {};
	if (tenant) delete fromInput["userId"];
	if (tenant) return { ...fromInput, userId: ctx.user!.id };
	return fromInput;
}

function parseAuto(spec: string): { table: string; op: "create" | "update" | "delete" | "get" } {
	const m = AUTO_RE.exec(spec.trim());
	if (!m) {
		throw new Error(
			`[s.auto] formato invalido "${spec}": atteso tabella.(create|update|delete|remove|get)`,
		);
	}
	const opRaw = m[2]!;
	const op = opRaw === "remove" ? "delete" : (opRaw as "create" | "update" | "delete" | "get");
	return { table: m[1]!, op };
}

/**
 * Trasforma `s({ auto: "items.delete", auth: true, … })` in config con `input` + `run`
 * (o solo `run` per `get`).
 */
export function expandAutoRoute(
	def: RouteAutoConfig,
): RouteInputConfig<unknown, unknown> {
	if (def.auth == null || def.auth === false) {
		throw new Error(`[s.auto] "${def.auto}" richiede auth (es. true, "admin", "user", ["user","customer"])`);
	}

	const { auto, auth, middlewares, ...rest } = def;
	const { table, op } = parseAuto(auto);
	const acc = getAccessor(table);
	const tenant = autoUsesTenantScopedUserId(def.auth) && tableUsesTenantUserId(table, acc);

	const common = { auth, middlewares, ...rest };

	if (op === "get") {
		const run = async (inp: { where?: Record<string, unknown> }, ctx: ServerContext) => {
			const where = mergeAutoGetWhere(tenant, ctx, inp);
			return acc.find(Object.keys(where).length > 0 ? { where } : {});
		};
		return { ...common, input: AUTO_GET_INPUT, run } as RouteInputConfig<unknown, unknown>;
	}

	if (op === "delete") {
		type AutoDeleteIn =
			| { mode: "where"; where: Record<string, unknown> }
			| { mode: "byId"; id: string };

		const deleteInput: InputSchema<AutoDeleteIn> = {
			parse(raw: unknown): AutoDeleteIn {
				if (raw !== null && typeof raw === "object" && !Array.isArray(raw)) {
					const o = raw as Record<string, unknown>;
					if ("where" in o) {
						if (typeof o.where !== "object" || o.where === null || Array.isArray(o.where)) {
							throw new ValidationError("where: expected object");
						}
						const w = o.where as Record<string, unknown>;
						if (Object.keys(w).length === 0) {
							throw new ValidationError("where: vuoto");
						}
						return { mode: "where", where: w };
					}
					if ("id" in o && o.id !== undefined) {
						return { mode: "byId", id: v.string().parse(o.id) };
					}
				}
				throw new ValidationError("expected { id } or { where }");
			},
		};

		const run = async (inp: AutoDeleteIn, ctx: ServerContext) => {
			if (inp.mode === "where") {
				const where = mergeAutoGetWhere(tenant, ctx, {
					where: stripUserId({ ...inp.where } as { userId?: string }),
				});
				const keys = Object.keys(where).filter((k) => !(tenant && k === "userId"));
				if (keys.length === 0) error("INPUT", "where: vuoto");
				const res = await acc.delete({ where });
				return { ok: true as const, count: res.count };
			}
			const id = inp.id;
			const where = tenant ? { id, userId: ctx.user!.id } : { id };
			const res = await acc.delete({ where });
			if (res.count === 0) error("NOT_FOUND", `${table} ${id}`);
			return { ok: true as const };
		};
		return { ...common, input: deleteInput, run } as RouteInputConfig<unknown, unknown>;
	}

	if (op === "update") {
		const patchById = acc.partial({ with: { id: v.string() }, min: 1 });
		/** Filtri batch: niente `id` / `userId` / timestamps nel payload (tenant su `userId` come in GET). */
		const batchWhere = acc.partial({ omit: ["userId"], min: 1 });
		const batchSet = acc.partial({ omit: ["userId"], min: 1 });

		type AutoUpdateIn =
			| { mode: "batch"; where: Record<string, unknown>; set: Record<string, unknown> }
			| { mode: "byId"; body: Record<string, unknown> };

		const input: InputSchema<AutoUpdateIn> = {
			parse(raw: unknown): AutoUpdateIn {
				if (raw !== null && typeof raw === "object" && !Array.isArray(raw)) {
					const o = raw as Record<string, unknown>;
					if (
						"where" in o &&
						"set" in o &&
						typeof o.where === "object" &&
						o.where !== null &&
						!Array.isArray(o.where) &&
						typeof o.set === "object" &&
						o.set !== null &&
						!Array.isArray(o.set)
					) {
						return {
							mode: "batch",
							where: batchWhere.parse(o.where) as Record<string, unknown>,
							set: batchSet.parse(o.set) as Record<string, unknown>,
						};
					}
				}
				return { mode: "byId", body: patchById.parse(raw) as Record<string, unknown> };
			},
		};

		const run = async (inp: AutoUpdateIn, ctx: ServerContext) => {
			if (inp.mode === "batch") {
				const where = mergeAutoGetWhere(tenant, ctx, { where: inp.where });
				const set = stripUserId(inp.set as { userId?: string });
				const res = await acc.update({ where, set });
				return { count: res.count, rows: res.rows };
			}
			const cleaned = stripUserId(inp.body as { id: string; userId?: string });
			const { id, ...patch } = cleaned;
			const where = tenant ? { id, userId: ctx.user!.id } : { id };
			const res = await acc.update({ where, set: patch });
			if (res.count === 0) error("NOT_FOUND", `${table} ${id}`);
			return { row: res.rows[0]! };
		};
		return { ...common, input, run } as RouteInputConfig<unknown, unknown>;
	}

	// create
	const omitKeys = OMIT_CREATE_BASE.filter((k) => k in acc) as string[];
	if (tenant) omitKeys.push("userId");
	if (omitKeys.length === 0) {
		throw new Error(`[s.auto] ${table}.create: nessun campo da omettere per input`);
	}
	const tuple = omitKeys as [string, ...string[]];
	const input = v.oneOrArray(acc.omit(...tuple)) as RouteInputConfig<unknown, unknown>["input"];
	const run = async (inp: unknown, ctx: ServerContext) => {
		const list = Array.isArray(inp) ? inp : [inp];
		const uid = ctx.user!.id;
		const rows = tenant ? list.map((r) => ({ ...(r as object), userId: uid })) : list;
		const created = await acc.create(rows as never);
		return { rows: created };
	};
	return { ...common, input, run } as RouteInputConfig<unknown, unknown>;
}

export function isAutoRouteDef(d: object): d is RouteAutoConfig {
	return (
		"auto" in d &&
		typeof (d as { auto: unknown }).auto === "string" &&
		!("input" in d) &&
		!("run" in d)
	);
}
