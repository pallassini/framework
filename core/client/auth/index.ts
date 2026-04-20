import { server } from "../server/server";
import { clearSession, setSessionId } from "./session";

const a = server.auth;

function persistSessionId(out: unknown): void {
	if (out && typeof out === "object" && "sessionId" in out) {
		const sid = (out as { sessionId?: unknown }).sessionId;
		if (typeof sid === "string") setSessionId(sid);
	}
}

/**
 * API auth lato client: `login` / `register` salvano `sessionId` in locale;
 * `me` usa l’header RPC automatico; `logout` cancella la sessione locale.
 */
export const auth = {
	login: async (input: Parameters<typeof a.login>[0]) => {
		const out = await a.login(input);
		persistSessionId(out);
		return out;
	},
	register: async (input: Parameters<typeof a.register>[0]) => {
		const out = await a.register(input);
		persistSessionId(out);
		return out;
	},
	me: a.me,
	logout: (): void => {
		clearSession();
	},
};
