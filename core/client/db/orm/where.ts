/** Costruttore predicati tipizzato (no SQL: solo AST lato client/engine). */

export type WhereAtom =
	| { readonly kind: "eq"; readonly field: string; readonly value: unknown }
	| { readonly kind: "neq"; readonly field: string; readonly value: unknown }
	| { readonly kind: "gt"; readonly field: string; readonly value: number }
	| { readonly kind: "gte"; readonly field: string; readonly value: number }
	| { readonly kind: "lt"; readonly field: string; readonly value: number }
	| { readonly kind: "lte"; readonly field: string; readonly value: number }
	| { readonly kind: "in"; readonly field: string; readonly values: readonly unknown[] };

export type WhereClause = { readonly and: readonly WhereAtom[] };

export function w(...atoms: WhereAtom[]): WhereClause {
	return { and: atoms };
}

/** `f("status").eq("active")` */
export function f(field: string) {
	return {
		eq: (value: unknown): WhereAtom => ({ kind: "eq", field, value }),
		neq: (value: unknown): WhereAtom => ({ kind: "neq", field, value }),
		gt: (value: number): WhereAtom => ({ kind: "gt", field, value }),
		gte: (value: number): WhereAtom => ({ kind: "gte", field, value }),
		lt: (value: number): WhereAtom => ({ kind: "lt", field, value }),
		lte: (value: number): WhereAtom => ({ kind: "lte", field, value }),
		in: (values: readonly unknown[]): WhereAtom => ({ kind: "in", field, values }),
	};
}

export function matchRow(row: Record<string, unknown>, clause: WhereClause): boolean {
	for (const a of clause.and) {
		const v = row[a.field];
		switch (a.kind) {
			case "eq":
				if (v !== a.value) return false;
				break;
			case "neq":
				if (v === a.value) return false;
				break;
			case "gt":
				if (typeof v !== "number" || !(v > a.value)) return false;
				break;
			case "gte":
				if (typeof v !== "number" || !(v >= a.value)) return false;
				break;
			case "lt":
				if (typeof v !== "number" || !(v < a.value)) return false;
				break;
			case "lte":
				if (typeof v !== "number" || !(v <= a.value)) return false;
				break;
			case "in":
				if (!a.values.includes(v)) return false;
				break;
			default:
				return false;
		}
	}
	return true;
}

/** Shorthand: `{ status: "x", id: 1 }` → AND di eq. */
export function shallowWhere(obj: Record<string, unknown>): WhereClause {
	return {
		and: Object.entries(obj).map(([field, value]) => ({ kind: "eq" as const, field, value })),
	};
}
