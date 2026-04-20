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

// ─── Field schemas (validator per-campo dallo shape tabella) ─────────────────

type AnyInputSchema = { parse(raw: unknown): unknown };

/**
 * Validator per-campo. Se il campo è già opzionale (`V` include `undefined`),
 * niente `.optional()`; altrimenti `.optional()` restituisce la variante opzionale.
 */
export type FieldSchema<V> = AnyInputSchema & { parse(raw: unknown): V } & (undefined extends V
		? unknown
		: { optional(): FieldSchema<V | undefined> });

// ─── TableAccessor (con overload object-form + campi direct-access) ──────────

type TableAccessorMethods<T extends DbRow> = {
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

	/** Sotto-oggetto coi soli campi indicati (mantiene opzionalità/default). */
	pick<K extends keyof T & string>(
		...keys: readonly [K, ...K[]]
	): AnyInputSchema & { parse(raw: unknown): { [P in K]: T[P] } };

	/** Sotto-oggetto con tutti i campi tranne quelli indicati. */
	omit<K extends keyof T & string>(
		...keys: readonly [K, ...K[]]
	): AnyInputSchema & { parse(raw: unknown): Omit<T, K> };

	/**
	 * Tutti i campi resi opzionali. Utile per input di `update`.
	 * `id` / `createdAt` / `updatedAt` sono esclusi di default (non si patchano mai).
	 * - `omit`: campi aggiuntivi da escludere.
	 * - `with`: campi extra da aggiungere (required).
	 * - `min`: almeno N campi (tra i partial, escludendo `with`) devono essere presenti.
	 */
	partial<
		K extends keyof T & string = never,
		R extends Record<string, AnyInputSchema> = Record<string, never>,
	>(opts?: {
		omit?: readonly K[];
		with?: R;
		min?: number;
	}): AnyInputSchema & {
		parse(raw: unknown): Partial<Omit<T, "id" | "createdAt" | "updatedAt" | K>> & {
			[P in keyof R]: R[P] extends { parse(raw: unknown): infer V } ? V : never;
		};
	};
};

/** Campi esposti direttamente sull'accessor (es. `db.items.name`, `db.resources.active`). */
type TableAccessorFields<T extends DbRow> = {
	[K in Exclude<keyof T, keyof TableAccessorMethods<T> | "parse"> & string]: FieldSchema<T[K]>;
};

/** Input per `create` (singola riga): campi dichiarati + `id`/`createdAt`/`updatedAt` opzionali. */
export type CreateInput<T extends DbRow> = Omit<T, "id"> & Partial<Pick<T, "id">>;

/**
 * Accessor tabellare. È:
 *   1. Chiamabile come `db.items(where?)` → alias di `find`.
 *   2. Un `InputSchema<CreateInput<T>>`, usabile direttamente come `input:` in `s({...})`.
 *      Per un input array: `v.array(db.items)`.
 *   3. Esposizione diretta dei campi: `db.items.name.optional()`.
 */
export type TableAccessor<T extends DbRow> = ((where?: Where<T>) => Promise<T[]>) &
	TableAccessorMethods<T> &
	TableAccessorFields<T> & { parse(raw: unknown): CreateInput<T> };
