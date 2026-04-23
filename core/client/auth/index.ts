import { server } from "../server/server";
import { createState } from "../state";
import { clearSession, getSessionId, setSessionId } from "./session";

const a = server.auth;

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

export const auth = {
	/** Snapshot reattivo dell’utente (da `server.auth.me`), non la funzione RPC. */
	me: session.me,
	login: async (...args: Parameters<typeof a.login>) => {
		const [input, opts] = args;
		const out = await a.login(input, {
			...opts,
			onSuccess: (data) => {
				persistSessionId(data);
				applyPublicUser(pickUser(data));
				opts?.onSuccess?.(data);
			},
		});
		return out;
	},
	register: async (...args: Parameters<typeof a.register>) => {
		const [input, opts] = args;
		const out = await a.register(input, {
			...opts,
			onSuccess: (data) => {
				persistSessionId(data);
				applyPublicUser(pickUser(data));
				opts?.onSuccess?.(data);
			},
		});
		return out;
	},
	refresh: refreshAuthSession,
	logout: (): void => {
		clearSession();
		applyPublicUser(null);
	},
};
