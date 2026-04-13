import { error } from "../error";
import type { WhereAtom, WhereClause } from "../../client/db/orm/where";

const REL_PATH_RE = /^[a-zA-Z0-9][a-zA-Z0-9_/-]{0,500}$/;
const FIELD_RE = /^[a-zA-Z_][a-zA-Z0-9_]{0,63}$/;

/** Prefisso server: il client manda solo `relPath` senza `..`. */
export const ORM_SERVER_PREFIX = "/app";

export function assertOrmRelPath(relPath: string): string {
	const t = relPath.trim();
	if (!t || t.startsWith("/") || t.includes("..") || !REL_PATH_RE.test(t)) {
		error("INPUT", "[ormDoc] relPath non valido");
	}
	return t;
}

export function serverTablePath(relPath: string): string {
	return `${ORM_SERVER_PREFIX}/${assertOrmRelPath(relPath)}`;
}

/** Solo record piatti JSON-safe (niente oggetti annidati per MVP). */
export function asPlainRow(x: unknown, maxKeys = 32): Record<string, unknown> {
	if (x === null || typeof x !== "object" || Array.isArray(x)) {
		error("INPUT", "[ormDoc] row/patch deve essere un oggetto");
	}
	const o = x as Record<string, unknown>;
	const out: Record<string, unknown> = {};
	let n = 0;
	for (const [k, v] of Object.entries(o)) {
		if (n >= maxKeys) break;
		if (!FIELD_RE.test(k)) continue;
		if (v === null) {
			out[k] = null;
			n++;
			continue;
		}
		const t = typeof v;
		if (t === "string") {
			const s = v as string;
			if (s.length > 4096) continue;
			out[k] = s;
			n++;
		} else if (t === "number" && Number.isFinite(v)) {
			out[k] = v;
			n++;
		} else if (t === "boolean") {
			out[k] = v;
			n++;
		}
	}
	return out;
}

function parseAtom(raw: unknown): WhereAtom {
	if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
		error("INPUT", "[ormDoc] atomo where invalido");
	}
	const o = raw as Record<string, unknown>;
	const kind = o.kind;
	if (typeof kind !== "string") error("INPUT", "[ormDoc] where.kind mancante");
	const field = o.field;
	if (typeof field !== "string" || !FIELD_RE.test(field)) error("INPUT", "[ormDoc] where.field invalido");

	switch (kind) {
		case "eq":
		case "neq":
			return { kind, field, value: o.value };
		case "gt":
		case "gte":
		case "lt":
		case "lte": {
			const v = o.value;
			if (typeof v !== "number" || !Number.isFinite(v)) error("INPUT", "[ormDoc] where value numerico atteso");
			return { kind, field, value: v };
		}
		case "in": {
			const vals = o.values;
			if (!Array.isArray(vals) || vals.length > 64) error("INPUT", "[ormDoc] where.in invalido");
			return { kind, field, values: vals };
		}
		default:
			error("INPUT", `[ormDoc] where.kind sconosciuto: ${kind}`);
	}
}

export function parseWhereClause(raw: unknown): WhereClause | undefined {
	if (raw === undefined || raw === null) return undefined;
	if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
		error("INPUT", "[ormDoc] where deve essere oggetto");
	}
	const o = raw as Record<string, unknown>;
	const and = o.and;
	if (!Array.isArray(and) || and.length > 32) error("INPUT", "[ormDoc] where.and invalido");
	const atoms: WhereAtom[] = [];
	for (const a of and) atoms.push(parseAtom(a));
	return { and: atoms };
}
