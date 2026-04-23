/** Metadati letti da `core/db/schema/table.ts` (indici univoci da shape). */
export const FIELD_UNIQUE = Symbol.for("framework.db.fieldUnique");

/** Tag su ogni schema passato per `optional()` — usato dai devtools per badge. */
export const FIELD_OPTIONAL = Symbol.for("framework.db.fieldOptional");

/** Descrittore del tipo del campo (usato dai devtools per mostrare string/number/enum/…). */
export const FIELD_TYPE = Symbol.for("framework.db.fieldType");

/** Descrittore serializzabile del tipo di un campo. */
export type FieldTypeDesc =
	| { kind: "string"; min?: number; max?: number }
	| { kind: "password"; min?: number; max?: number }
	| {
			kind: "number";
			/** Catturato da `.min(n, ...)` e `.nonnegative()` (= 0). */
			min?: number;
			/** Catturato da `.max(n, ...)` e `.nonpositive()` (= 0). */
			max?: number;
			/** `true` se lo schema ha `.int()`: la UI non permetterà decimali. */
			int?: boolean;
			/** Catturato da `.step(n, ...)`. */
			step?: number;
	  }
	| { kind: "boolean" }
	| { kind: "datetime" }
	| { kind: "date" }
	| { kind: "time" }
	| { kind: "enum"; options: readonly string[] }
	| { kind: "array"; of: FieldTypeDesc }
	| { kind: "object"; shape?: Record<string, FieldTypeDesc> }
	| { kind: "fk"; table: string }
	| { kind: "unknown" };

/** Attacca un `FieldTypeDesc` a uno schema (non-enumerable, Symbol). */
export function tagFieldType<T extends object>(schema: T, type: FieldTypeDesc): T {
	try {
		Object.defineProperty(schema, FIELD_TYPE, {
			value: type,
			enumerable: false,
			configurable: true,
			writable: true,
		});
	} catch {
		/* */
	}
	return schema;
}

/** Legge un `FieldTypeDesc` se presente. */
export function readFieldType(schema: unknown): FieldTypeDesc | undefined {
	if (typeof schema !== "object" || schema === null) return undefined;
	const t = Reflect.get(schema, FIELD_TYPE) as FieldTypeDesc | undefined;
	return t;
}
