import { getSessionId } from "./session";

/** Header da unire alle richieste RPC se c’è una sessione salvata. */
export function getAuthHeaders(): HeadersInit {
	const sid = getSessionId();
	if (!sid) return {};
	return { Authorization: `Bearer ${sid}` };
}
