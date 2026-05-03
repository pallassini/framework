import type { InputSchema } from "../../../client/validator/properties/defs";
import type { Db, DbTable, User } from "db";
import type { CorsRule } from "../cors";
import type { ServerContext } from "../../routes/context";
import type { ConcurrencyOpts, RateLimitOpts, SizeLimitOpts } from "./opts";
import type { Middleware } from "./types";

/** Operazioni supportate da `s({ auto: "tabella.…" })`. */
export type RouteAutoOp = "create" | "update" | "delete" | "remove" | "get";

/** Stringhe `tabella.operazione` tipizzate sui nomi tabella del progetto (autocomplete in IDE). */
export type RouteAutoSpec = `${DbTable}.${RouteAutoOp}`;
type RouteAutoTable<S extends RouteAutoSpec> = S extends `${infer T}.${RouteAutoOp}` ? T & DbTable : never;
type RouteAutoOpFromSpec<S extends RouteAutoSpec> = S extends `${DbTable}.${infer O}` ? O & RouteAutoOp : never;
type RouteAutoRow<S extends RouteAutoSpec> = Awaited<
	ReturnType<Db["tables"][RouteAutoTable<S>]["find"]>
>[number];

export function timeoutMs(timeout: number | { ms: number } | undefined): number | undefined {
	if (timeout == null) return undefined;
	return typeof timeout === "number" ? timeout : timeout.ms;
}

/** Ruolo in `users.role` (schema DB). */
export type UserRole = User["role"];

/**
 * - `true`: sessione + scope tenant su `user.*`, **nessun** filtro ruolo (compat / profilo / `auth.me`).
 * - `false` / omesso: nessun middleware auth sulla route.
 * - `"admin"`: sessione + ruolo admin (tipico `admin.*`).
 * - un ruolo o `readonly UserRole[]`: sessione + uno dei ruoli + scope tenant su `user.*`.
 */
export type RouteAuth = boolean | "admin" | UserRole | readonly UserRole[];

type RouteOpts = {
	auth?: RouteAuth;
	middlewares?: Middleware[];
	rateLimit?: RateLimitOpts;
	timeout?: number | { ms: number };
	cache?: number;
	cors?: CorsRule;
	sizeLimit?: SizeLimitOpts;
	concurrency?: ConcurrencyOpts;
};

/**
 * Shorthand CRUD: `auto: "tabella.operazione"` con `operazione` ∈ create | update | delete | remove | get.
 * Imposta `input` e `run` in automatico (scope `userId` se la tabella ha `userId` e l’auth non è solo `"admin"`).
 * Per `*.get`: payload `{ where?: … }` e/o campi di filtro sul root (uniti), sempre col vincolo tenant (`userId` non sovrascrivibile).
 */
export type RouteInputConfig<I, O> = RouteOpts & {
	input: InputSchema<I>;
	run: (input: I, ctx: ServerContext) => O | Promise<O>;
	auto?: never;
};

export type RouteNoInputConfig<O> = RouteOpts & {
	run: (ctx: ServerContext) => O | Promise<O>;
	auto?: never;
};

/** Route generata da `auto` (senza `input` / `run` nel sorgente). */
export type RouteAutoConfig<S extends RouteAutoSpec = RouteAutoSpec> = RouteOpts & {
	auto: S;
	input?: never;
	run?: never;
};

export type RouteAutoInput<S extends RouteAutoSpec> = RouteAutoOpFromSpec<S> extends "get"
	? Record<string, unknown> | undefined
	: RouteAutoOpFromSpec<S> extends "delete" | "remove"
		? { id: string }
		: RouteAutoOpFromSpec<S> extends "create"
			? Record<string, unknown> | readonly Record<string, unknown>[]
			: Record<string, unknown>;

export type RouteAutoOutput<S extends RouteAutoSpec> = RouteAutoOpFromSpec<S> extends "get"
	? RouteAutoRow<S>[]
	: RouteAutoOpFromSpec<S> extends "create"
		? { rows: RouteAutoRow<S>[] }
		: RouteAutoOpFromSpec<S> extends "update"
			? { row: RouteAutoRow<S> }
			: RouteAutoOpFromSpec<S> extends "delete" | "remove"
				? { ok: true }
				: unknown;
