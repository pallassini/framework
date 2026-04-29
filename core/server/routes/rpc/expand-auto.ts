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

/** Input opzionale per `*.get`: filtri extra in `find` (il tenant `userId` non è sovrascrivibile). */
const AUTO_GET_INPUT: InputSchema<{ where?: Record<string, unknown> }> = {
	parse(raw) {
		if (raw === undefined || raw === null) return {};
		if (typeof raw !== "object" || Array.isArray(raw)) {
			throw new ValidationError("expected object");
		}
		const o = raw as Record<string, unknown>;
		if (o.where === undefined) return {};
		if (typeof o.where !== "object" || o.where === null || Array.isArray(o.where)) {
			throw new ValidationError("where: expected object");
		}
		return { where: { ...(o.where as Record<string, unknown>) } };
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
		const input = v.object({ id: v.string() });
		const run = async (inp: { id: string }, ctx: ServerContext) => {
			const { id } = inp;
			const where = tenant ? { id, userId: ctx.user!.id } : { id };
			const res = await acc.delete({ where });
			if (res.count === 0) error("NOT_FOUND", `${table} ${id}`);
			return { ok: true as const };
		};
		return { ...common, input, run } as RouteInputConfig<unknown, unknown>;
	}

	if (op === "update") {
		const input = acc.partial({ with: { id: v.string() }, min: 1 }) as RouteInputConfig<unknown, unknown>["input"];
		const run = async (inp: unknown, ctx: ServerContext) => {
			const cleaned = stripUserId(inp as { id: string; userId?: string });
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
