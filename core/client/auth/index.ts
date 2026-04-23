import type { RpcCallbacks } from "../server/server";
import type { ServerRoutes } from "../server/routes-gen";
import { server } from "../server/server";
import { createState } from "../state";
import { clearSession, getSessionId, setSessionId } from "./session";

const a = server.auth;

type LoginOut = ServerRoutes["auth.login"]["out"];
type RegisterOut = ServerRoutes["auth.register"]["out"];

/** Stesso shape di `auth.me` lato server (JSON: date → ISO string). */
export type AuthPublicUser = {
	readonly id: string;
	readonly email: string;
	readonly username?: string;
	readonly role: "admin" | "user" | "customer";
	readonly createdAt?: string;
	readonly updatedAt?: string;
	readonly deletedAt?: string | null;
};

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
 * Sessione utente reattiva: popolata da `auth.refresh()` (che chiama `server.auth.me`)
 * e da login/register. In UI: `auth.me.role()`, `auth.me.email()`, …
 * Ospite: `auth.me.id() === ""`.
 */
/** Ruolo vuoto = ospite (mai inviato dal server così). */
type LocalRole = "" | AuthPublicUser["role"];

const session = createState({
	me: {
		id: "",
		email: "",
		username: undefined as string | undefined,
		role: "" as LocalRole,
		createdAt: undefined as string | undefined,
		updatedAt: undefined as string | undefined,
		deletedAt: null as string | null,
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
	const m = session.me;
	if (!u) {
		m.id("");
		m.email("");
		m.username(undefined);
		m.role("");
		m.createdAt(undefined);
		m.updatedAt(undefined);
		m.deletedAt(null);
		return;
	}
	m.id(u.id);
	m.email(u.email);
	m.username(u.username);
	m.role(u.role);
	m.createdAt(u.createdAt);
	m.updatedAt(u.updatedAt);
	m.deletedAt(u.deletedAt ?? null);
}

/**
 * Chiama `server.auth.me` e aggiorna `auth.me.*`. Usato da `App()` all’avvio.
 * RPC diretta: `await server.auth.me()`.
 */
export async function refreshAuthSession(): Promise<void> {
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
			persistSessionId(data);
			applyPublicUser(pickUser(data));
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
	/** Snapshot reattivo dell’utente (da `server.auth.me`), non la funzione RPC. */
	me: session.me,
	/**
	 * Sempre `AuthRpcResult` (`success` / `error` / `ratelimit` + `data` o `err`), senza throw.
	 * L’RPC che va in eccezione: `server.auth.login`.
	 */
	login: authLogin,
	/** Stesso modello del login. */
	register: authRegister,
	refresh: refreshAuthSession,
	logout: (): void => {
		clearSession();
		applyPublicUser(null);
	},
};
