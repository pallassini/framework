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

export type TableAccessor<T extends DbRow> = ((where?: Where<T>) => Promise<T[]>) & {
	create(rows: OneOrMany<Omit<T, "id"> & Partial<Pick<T, "id">>>): Promise<T[]>;
	find(where?: Where<T>, opts?: FindOptions<T>): Promise<T[]>;
	byId(id: string): Promise<T | undefined>;
	update(where: Where<T>, patch: UpdatePatch<T>): Promise<UpdateResult<T>>;
	delete(where: Where<T>): Promise<DeleteResult>;
	count(where?: Where<T>): Promise<number>;
	clear(): Promise<number>;
};
