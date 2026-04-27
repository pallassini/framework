import { tagFieldType, type SchemaWithInputDefault, tagFieldDefault } from "../field-meta";
import { optionalKeepingFieldMeta } from "../chain";
import { fk, type FkSchema } from "../fk";
import { ValidationError, type InputSchema } from "./defs";

/** Risposta tipica di `user.resource.get()` — `v.enum(x)` usa `resources[].id`. */
export type ResourceListPayload = {
	readonly resources?: readonly { readonly id: string }[];
};

/** Stringa che deve essere una delle opzioni (controllo runtime + tipo `T[number]`). */
export type LiteralsSchema<T extends readonly [string, ...string[]]> = InputSchema<T[number]> & {
	optional(): InputSchema<T[number] | undefined>;
	default<D extends T[number]>(value: D): LiteralsSchema<T> & SchemaWithInputDefault;
};

function makeLiteralsSchema<const T extends readonly [string, ...string[]]>(
	allowed: T,
	set: Set<string>,
	parseImpl: (raw: unknown) => T[number],
): LiteralsSchema<T> {
	const base: InputSchema<T[number]> = { parse: parseImpl };
	const out = Object.assign(base, {
		optional() {
			return optionalKeepingFieldMeta(base);
		},
		default(def: T[number]) {
			if (!set.has(def as string)) {
				throw new ValidationError(`default must be one of: ${allowed.join(", ")}`);
			}
			return tagFieldDefault(
				makeLiteralsSchema(allowed, set, (raw) => {
					if (raw === undefined) return def;
					return parseImpl(raw);
				}) as LiteralsSchema<T>,
			);
		},
	}) as LiteralsSchema<T>;
	tagFieldType(out, { kind: "enum", options: [...allowed] });
	return out;
}

function literalsFromResourcePayload(
	data: ResourceListPayload | null | undefined,
): LiteralsSchema<[string, ...string[]]> | FkSchema {
	if (data == null) {
		return fk("resources");
	}
	const ids = (data.resources ?? []).map((r) => r.id).filter((id): id is string => typeof id === "string");
	if (ids.length === 0) {
		return fk("resources");
	}
	const tuple = [ids[0]!, ...ids.slice(1)] as [string, ...string[]];
	const set = new Set(ids);
	return makeLiteralsSchema(tuple, set, (raw) => {
		if (typeof raw !== "string" || !set.has(raw)) {
			throw new ValidationError(`expected one of: ${tuple.join(", ")}`);
		}
		return raw;
	});
}

export function literals<const T extends readonly [string, ...string[]]>(allowed: T): LiteralsSchema<T>;
export function literals(
	allowed: ResourceListPayload | null | undefined,
): LiteralsSchema<[string, ...string[]]> | FkSchema;
export function literals(allowed: unknown): unknown {
	if (allowed == null || (typeof allowed === "object" && !Array.isArray(allowed) && "resources" in (allowed as object))) {
		return literalsFromResourcePayload(allowed as ResourceListPayload | null | undefined);
	}
	if (!Array.isArray(allowed) || allowed.length === 0) {
		throw new ValidationError("literals: expected non-empty tuple or resource list object");
	}
	const tuple = allowed as readonly [string, ...string[]];
	const set = new Set<string>(tuple);
	return makeLiteralsSchema(tuple, set, (raw) => {
		if (typeof raw !== "string" || !set.has(raw)) {
			throw new ValidationError(`expected one of: ${tuple.join(", ")}`);
		}
		return raw as (typeof tuple)[number];
	});
}
