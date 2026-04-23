import type { RpcCallbacks } from "../server/server";
import type { ServerRoutes } from "../server/routes-gen";
import { server } from "../server/server";
import { signal, type Signal } from "../state";
import { clearSession, getSessionId, setSessionId } from "./session";

const a = server.auth;

type LoginOut = ServerRoutes["auth.login"]["out"];
type RegisterOut = ServerRoutes["auth.register"]["out"];
type MeOut = ServerRoutes["auth.me"]["out"];

/**
 * Shape di `auth.me` **inferito** dal ritorno di `server.auth.me`.
 * Aggiungendo un campo alla tabella `users` in `db/index.ts`, il ritorno del server lo include
 * automaticamente (`publicUserFromRow` itera lo shape meno `password`) e quindi `AuthPublicUser`
 * lo eredita senza alcun altro edit lato client.
 */
export type AuthPublicUser = MeOut extends { user: infer U } ? U : never;

/**
 * Ritorno **sempre** di `auth.login` / `auth.register`: non fanno throw;
 * in caso di successo c’è `data`, altrimenti `err` e i boolean `success` / `error` / `ratelimit`.
 */
export type AuthRpcResult<O> =
	| { success: true; error: false; ratelimit: false; data: O }
	| { success: false; error: true; ratelimit: boolean; err: Error };

/** `true` se l’errore RPC è `type === "RATE_LIMIT"` (stesso segnale di `onRateLimit` / `res.ratelimit`). */
export function isAuthRateLimitError(e: unknown): boolean {
	return e instanceof Error && (e as { type?: string }).type === "RATE_LIMIT";
}

/**
 * Reattività utente: **un solo signal** `userSignal` contiene l'intero oggetto (o `null` ospite);
 * `auth.me.campoX()` è un signal derivato creato al volo tramite proxy → qualsiasi campo presente
 * nel payload del server è automaticamente disponibile senza liste hardcoded.
 *
 * Convenzione: ospite = `auth.me.role() === ""` (il server non manda mai `""`, quindi è un marker
 * sicuro “non loggato”). Altri campi → `undefined` quando ospite.
 */
const userSignal = signal<AuthPublicUser | null>(null);

/** Dopo la prima `auth.refresh()` in App: evita redirect con `role === ""` prima che `server.auth.me` abbia risposto. */
const sessionResolved = signal(false);

/** Tipo di `auth.me`: signal dell’utente (o null) + signal derivato per ogni campo di `AuthPublicUser`. */
export type AuthMe = Signal<AuthPublicUser | null> & {
	readonly [K in keyof AuthPublicUser]-?: Signal<
		K extends "role" ? "" | NonNullable<AuthPublicUser[K]> : AuthPublicUser[K] | undefined
	>;
};

const derivedCache = new Map<string, Signal<unknown>>();

/** Property del signal base che **non** vanno intercettate (altrimenti rompono `auth.me(…)`, `.get()`, ecc.). */
const RESERVED_ME_KEYS = new Set<string | symbol>([
	"value",
	"valueOf",
	"toString",
	"get",
	"reset",
	"length",
	"name",
	"prototype",
	"apply",
	"call",
	"bind",
	"then",
	"catch",
	"finally",
	"constructor",
]);

function deriveField(key: string): Signal<unknown> {
	const cached = derivedCache.get(key);
	if (cached) return cached;
	const s = signal(() => {
		const u = userSignal();
		if (u == null) {
			/** `role === ""` = ospite (convenzione storica); altri campi → undefined. */
			if (key === "role") return "";
			return undefined;
		}
		return (u as Record<string, unknown>)[key];
	}) as Signal<unknown>;
	derivedCache.set(key, s);
	return s;
}

const me: AuthMe = new Proxy(userSignal as unknown as AuthMe, {
	get(target, prop, receiver) {
		if (typeof prop === "symbol" || RESERVED_ME_KEYS.has(prop)) {
			return Reflect.get(target, prop, receiver);
		}
		return deriveField(prop);
	},
});

function persistSessionId(out: unknown): void {
	if (out && typeof out === "object" && "sessionId" in out) {
		const sid = (out as { sessionId?: unknown }).sessionId;
		if (typeof sid === "string") setSessionId(sid);
	}
}

function pickUser(out: unknown): AuthPublicUser | null {
	if (out && typeof out === "object" && "user" in out) {
		return (out as { user: AuthPublicUser }).user;
	}
	return null;
}

function applyPublicUser(u: AuthPublicUser | null): void {
	userSignal(u);
}

/**
 * Chiama `server.auth.me` e aggiorna `auth.me.*`. Usato da `App()` all’avvio.
 * RPC diretta: `await server.auth.me()`.
 */
export async function refreshAuthSession(): Promise<void> {
	try {
		if (!getSessionId()) {
			applyPublicUser(null);
			return;
		}
		try {
			const out = await a.me();
			applyPublicUser(pickUser(out));
		} catch {
			applyPublicUser(null);
		}
	} finally {
		sessionResolved(true);
	}
}

async function authLogin(
	input: Parameters<typeof a.login>[0],
	opts?: RpcCallbacks<LoginOut>,
): Promise<AuthRpcResult<LoginOut>> {
	const merged: RpcCallbacks<LoginOut> = {
		...opts,
		onSuccess: (data) => {
			persistSessionId(data);
			applyPublicUser(pickUser(data));
			opts?.onSuccess?.(data);
		},
	};
	try {
		const data = await a.login(input, merged);
		return { success: true, error: false, ratelimit: false, data };
	} catch (err) {
		const e = err instanceof Error ? err : new Error(String(err));
		return { success: false, error: true, ratelimit: isAuthRateLimitError(e), err: e };
	}
}

async function authRegister(
	input: Parameters<typeof a.register>[0],
	opts?: RpcCallbacks<RegisterOut>,
): Promise<AuthRpcResult<RegisterOut>> {
	const merged: RpcCallbacks<RegisterOut> = {
		...opts,
		onSuccess: (data) => {
			/** Solo con `login: true` nella richiesta il server manda `sessionId` → sessione come dopo il login. */
			if (
				data &&
				typeof data === "object" &&
				"sessionId" in data &&
				typeof (data as { sessionId?: unknown }).sessionId === "string" &&
				(data as { sessionId: string }).sessionId.length > 0
			) {
				persistSessionId(data);
				applyPublicUser(pickUser(data));
			}
			opts?.onSuccess?.(data);
		},
	};
	try {
		const data = await a.register(input, merged);
		return { success: true, error: false, ratelimit: false, data };
	} catch (err) {
		const e = err instanceof Error ? err : new Error(String(err));
		return { success: false, error: true, ratelimit: isAuthRateLimitError(e), err: e };
	}
}

export const auth = {
	/**
	 * Snapshot reattivo dell’utente. Ogni property letta (`auth.me.role()`, `auth.me.email()`, …)
	 * ritorna un signal **derivato** dal payload di `server.auth.me`: aggiungendo un campo in `users`
	 * è subito accessibile senza edit qui.
	 * `auth.me.role() === ""` ⇒ ospite / sessione non ancora risolta.
	 */
	me,
	/** `true` dopo almeno un `auth.refresh` completato (ospite o utente). */
	ready: sessionResolved,
	/**
	 * Sempre `AuthRpcResult` (`success` / `error` / `ratelimit` + `data` o `err`), senza throw.
	 * L’RPC che va in eccezione: `server.auth.login`.
	 */
	login: authLogin,
	/**
	 * Registrazione. Di default **non** imposta la sessione nel client (non è come il login);
	 * passa nell’input `login: true` (insieme a email, password, …) se dopo la registrazione
	 * l’utente deve restare autenticato.
	 */
	register: authRegister,
	refresh: refreshAuthSession,
	logout: (): void => {
		clearSession();
		applyPublicUser(null);
	},
};
