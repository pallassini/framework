export type DbScalar = string | number | boolean | null;

export type DbRow = {
	id: string;
	[key: string]: unknown;
};

export type OneOrMany<T> = T | readonly T[];

export type WhereOps<T> = {
	$eq?: T;
	$ne?: T;
	$in?: readonly T[];
	$nin?: readonly T[];
	$lt?: T;
	$lte?: T;
	$gt?: T;
	$gte?: T;
};

export type WhereValue<T> = T | WhereOps<T>;

export type Where<T extends DbRow> = {
	$and?: readonly Where<T>[];
	$or?: readonly Where<T>[];
} & {
	[K in keyof T]?: WhereValue<T[K]>;
};

export type FindOptions<T extends DbRow> = {
	limit?: number;
	offset?: number;
	orderBy?: keyof T;
	direction?: "asc" | "desc";
};

export type UpdatePatch<T extends DbRow> =
	| Partial<Omit<T, "id">>
	| ((row: Readonly<T>) => Partial<Omit<T, "id">> | null | undefined);

export type UpdateResult<T extends DbRow> = {
	count: number;
	rows: T[];
};

export type DeleteResult = {
	count: number;
	ids: string[];
};

// ─── New object-form options ─────────────────────────────────────────────────

/** Opzioni unificate per `find({ ... })`. Tutti i campi opzionali. */
export type FindOpts<T extends DbRow> = {
	where?: Where<T>;
	/**
	 * Proiezione + join: array di path separati da ".".
	 *
	 * - `"id"`, `"name"` → campo scalare.
	 * - `"customerId.name"` → segue la FK e produce `{ customerId: { id, name } }`.
	 * - `"items.itemId.name"` → map dell'array + FK interna.
	 * - `"assignments.name"` → map di array di FK.
	 *
	 * Path che condividono lo stesso prefisso vengono fusi automaticamente.
	 */
	select?: readonly string[];
	orderBy?: keyof T & string;
	direction?: "asc" | "desc";
	limit?: number;
	offset?: number;
};

export type UpdateOpts<T extends DbRow> = {
	where: Where<T>;
	set: UpdatePatch<T>;
};

export type DeleteOpts<T extends DbRow> = {
	where: Where<T>;
};

export type CountOpts<T extends DbRow> = {
	where?: Where<T>;
};

// ─── Projection type (best-effort) ───────────────────────────────────────────

type PathSegs<P extends string> = P extends `${infer H}.${infer R}` ? [H, ...PathSegs<R>] : [P];

type Project1<T, Segs extends readonly string[]> = Segs extends readonly [
	infer H extends string,
	...infer Rest extends string[],
]
	? Rest extends []
		? H extends keyof T
			? { [K in H]: T[K] }
			: Record<string, unknown>
		: H extends keyof T
			? NonNullable<T[H]> extends readonly (infer U)[]
				? U extends object
					? { [K in H]: Project1<U, Rest>[] }
					: { [K in H]: Record<string, unknown>[] }
				: NonNullable<T[H]> extends object
					? { [K in H]: Project1<NonNullable<T[H]>, Rest> }
					: // scalare + segue dot → FK risolta, senza tipo disponibile
						{ [K in H]: Record<string, unknown> }
			: Record<string, unknown>
	: never;

type UnionToIntersection<U> = (U extends unknown ? (x: U) => unknown : never) extends (
	x: infer I,
) => unknown
	? I
	: never;

/** Risultato proiettato di un array `select`. */
export type Projected<T, S extends readonly string[]> =
	UnionToIntersection<
		S[number] extends infer P ? (P extends string ? Project1<T, PathSegs<P>> : never) : never
	> extends infer R
		? { [K in keyof R]: R[K] } & { id: string }
		: never;

// ─── TableAccessor (con overload object-form) ────────────────────────────────

export type TableAccessor<T extends DbRow> = ((where?: Where<T>) => Promise<T[]>) & {
	create(rows: OneOrMany<Omit<T, "id"> & Partial<Pick<T, "id">>>): Promise<T[]>;

	/** Legacy: `find(where?, opts?)`. */
	find(where?: Where<T>, opts?: FindOptions<T>): Promise<T[]>;
	/** Object-form con `select`: proietta e segue le FK indicate. */
	find<S extends readonly string[]>(
		opts: FindOpts<T> & { select: S },
	): Promise<Projected<T, S>[]>;
	/** Object-form senza `select`: ritorna la riga intera. */
	find(opts: FindOpts<T>): Promise<T[]>;

	byId(id: string): Promise<T | undefined>;

	/** Legacy: `update(where, patch)`. */
	update(where: Where<T>, patch: UpdatePatch<T>): Promise<UpdateResult<T>>;
	/** Object-form: `update({ where, set })`. */
	update(opts: UpdateOpts<T>): Promise<UpdateResult<T>>;

	/** Legacy: `delete(where)`. */
	delete(where: Where<T>): Promise<DeleteResult>;
	/** Object-form: `delete({ where })`. */
	delete(opts: DeleteOpts<T>): Promise<DeleteResult>;

	/** Legacy: `count(where?)`. */
	count(where?: Where<T>): Promise<number>;
	/** Object-form: `count({ where })`. */
	count(opts: CountOpts<T>): Promise<number>;

	clear(): Promise<number>;
};
