import { getSessionId } from "./session";
import { getTargetUserId } from "./target-user";

/** Header da unire alle richieste RPC se c’è una sessione salvata. */
export function getAuthHeaders(): HeadersInit {
	const sid = getSessionId();
	const targetUserId = getTargetUserId();
	const out: Record<string, string> = {};
	if (sid) out["Authorization"] = `Bearer ${sid}`;
	if (targetUserId) out["x-target-user-id"] = targetUserId;
	return out;
}
