/**
 * Web push — **due RPC**:
 *
 * - **`notification.subscribe`** — chiave VAPID e registrazione (`mode: publicKey` | `register`); `persist: true` richiede sessione + **`deviceId`** (riga `device` dello stesso utente) e salva/aggiorna `notification`.
 * - **`notification`** (`export default`) — invia push all’ultima subscription in RAM (`title` / `body` nel payload JSON per lo SW).
 */
import webpush from "web-push";
import { db } from "db";
import { error, s } from "server";
import type { ServerContext } from "../../core/server/routes/context";
import { ValidationError, type InputSchema } from "../../core/client/validator/properties/defs";

function pushSrvLog(phase: string, detail: Record<string, unknown>): void {
	console.log(`[push] ${phase}`, detail);
}

const DEFAULT_VAPID_SUBJECT = "mailto:webpush@example.com";

function vapidSubject(): string {
	return process.env.VAPID_SUBJECT?.trim() || DEFAULT_VAPID_SUBJECT;
}

let cachedPublicKey: string | null = null;
let vapidKeySource: "env" | "generated" = "env";

function ensureVapid(): string {
	if (cachedPublicKey) return cachedPublicKey;
	const pub = process.env.VAPID_PUBLIC_KEY?.trim();
	const priv = process.env.VAPID_PRIVATE_KEY?.trim();
	const subject = vapidSubject();
	if (pub && priv) {
		webpush.setVapidDetails(subject, pub, priv);
		cachedPublicKey = pub;
		vapidKeySource = "env";
	} else {
		const keys = webpush.generateVAPIDKeys();
		webpush.setVapidDetails(subject, keys.publicKey, keys.privateKey);
		cachedPublicKey = keys.publicKey;
		vapidKeySource = "generated";
		console.warn(
			"[push] VAPID_* assenti: chiavi generate per questa sessione server. Imposta VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY e VAPID_SUBJECT=mailto:contatti@tuodominio.it (Apple rifiuta spesso sub tipo @localhost).",
		);
	}
	return cachedPublicKey!;
}

let lastSubscription: webpush.PushSubscription | null = null;

function isPushSubscription(o: unknown): o is webpush.PushSubscription {
	if (typeof o !== "object" || o === null) return false;
	const x = o as Record<string, unknown>;
	return typeof x.endpoint === "string" && x.endpoint.length > 0;
}

async function userIdFromSession(ctx: ServerContext): Promise<string | undefined> {
	const auth = ctx.headers.get("authorization");
	const sid =
		auth?.toLowerCase().startsWith("bearer ") && auth.length > 7
			? auth.slice(7).trim()
			: ctx.headers.get("x-session-id")?.trim();
	if (!sid) return undefined;
	const rows = await db.sessions.find({ id: { $eq: sid } }, { limit: 1 });
	const sess = rows[0];
	if (!sess || sess.revokedAt != null) return undefined;
	const exp = sess.expiresAt;
	const expMs =
		exp instanceof Date
			? exp.getTime()
			: typeof exp === "number"
				? exp
				: typeof exp === "string"
					? new Date(exp).getTime()
					: NaN;
	if (!Number.isFinite(expMs) || expMs < Date.now()) return undefined;
	return sess.userId as string;
}

type SubscribeIn =
	| { mode: "publicKey" }
	| { mode: "register"; subscription: webpush.PushSubscription; persist?: boolean; deviceId?: string };

const subscribeInput: InputSchema<SubscribeIn> = {
	parse(raw) {
		if (typeof raw !== "object" || raw === null) throw new ValidationError("expected object");
		const o = raw as Record<string, unknown>;
		const mode = o.mode;
		if (mode === "publicKey") return { mode: "publicKey" };
		if (mode === "register") {
			if (!isPushSubscription(o.subscription)) throw new ValidationError("register: subscription");
			const persist = o.persist === true;
			const deviceId = typeof o.deviceId === "string" && o.deviceId.trim() ? o.deviceId.trim() : undefined;
			if (persist && !deviceId) throw new ValidationError("persist: deviceId obbligatorio");
			return { mode: "register", subscription: o.subscription, persist, deviceId };
		}
		throw new ValidationError(`subscribe: mode sconosciuto ${String(mode)}`);
	},
};

export const subscribe = s({
	input: subscribeInput,
	run: async (input, ctx) => {
		if (input.mode === "publicKey") {
			const publicKey = ensureVapid();
			pushSrvLog("subscribe_publicKey", {
				source: vapidKeySource,
				subject: vapidSubject(),
				publicKeyLen: publicKey.length,
			});
			return {
				ok: true as const,
				publicKey,
				logLine: `publicKey len=${publicKey.length} source=${vapidKeySource}`,
			};
		}
		lastSubscription = input.subscription;
		let host = "?";
		try {
			host = new URL(input.subscription.endpoint).host;
		} catch {
			/* */
		}
		const kl = input.subscription.keys;
		pushSrvLog("subscribe_register", {
			host,
			endpointLen: input.subscription.endpoint.length,
			persist: Boolean(input.persist),
		});
		if (input.persist) {
			const uid = await userIdFromSession(ctx);
			if (!uid) error("UNAUTHORIZED", "persist richiede sessione valida");
			const deviceId = input.deviceId!;
			const devRows = await db.device.find({ id: { $eq: deviceId } }, { limit: 1 });
			const dev = devRows[0];
			if (!dev || dev.userId !== uid) error("FORBIDDEN", "deviceId non valido per questo utente");
			const json = JSON.stringify(input.subscription);
			const existing = await db.notification.find({ deviceId: { $eq: deviceId } }, { limit: 1 });
			const row = existing[0];
			if (row) {
				await db.notification.update({ where: { id: row.id }, set: { subscription: json, userId: uid } });
			} else {
				await db.notification.create({ deviceId, userId: uid, subscription: json } as never);
			}
			pushSrvLog("subscribe_persist", { userId: uid, deviceId });
		}
		return {
			ok: true as const,
			logLine: `register host=${host} p256dhLen=${kl?.p256dh?.length ?? 0} authLen=${kl?.auth?.length ?? 0}${input.persist ? " +DB" : " RAM"}`,
		};
	},
});

type SendIn = { title?: string; body?: string };

const sendInput: InputSchema<SendIn> = {
	parse(raw) {
		if (raw == null) return {};
		if (typeof raw !== "object") throw new ValidationError("expected object");
		const o = raw as Record<string, unknown>;
		return {
			title: typeof o.title === "string" ? o.title : undefined,
			body: typeof o.body === "string" ? o.body : undefined,
		};
	},
};

export default s({
	input: sendInput,
	run: async (input) => {
		if (!lastSubscription) {
			pushSrvLog("send_skip", { reason: "no_subscription_in_memory" });
			return {
				ok: false as const,
				error: "Nessuna subscription in RAM: usa prima notification.subscribe (mode register).",
				logLine: "send skipped",
			};
		}
		ensureVapid();
		const payload = JSON.stringify({
			title: input.title ?? "Flow",
			body: input.body ?? "Notifica",
		});
		let endpointHost = "?";
		try {
			endpointHost = new URL(lastSubscription.endpoint).host;
		} catch {
			/* */
		}
		const apple = lastSubscription.endpoint.includes("push.apple.com");
		const urgency = apple ? "high" : "normal";
		pushSrvLog("send", {
			endpointHost,
			apple,
			urgency,
			payloadBytes: payload.length,
			vapidSource: vapidKeySource,
		});
		try {
			const result = await webpush.sendNotification(lastSubscription, payload, {
				TTL: apple ? 3600 : 60,
				urgency,
			});
			pushSrvLog("send_ok", { statusCode: result.statusCode });
			return {
				ok: true as const,
				logLine: `sent status=${result.statusCode} apple=${apple}`,
			};
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			let upstreamStatus: number | undefined;
			let upstreamBody = "";
			if (e && typeof e === "object" && "statusCode" in e) {
				const w = e as { statusCode: number; body?: string };
				upstreamStatus = w.statusCode;
				upstreamBody = String(w.body ?? "");
			}
			pushSrvLog("send_fail", { message: msg, upstreamStatus, upstreamBody: upstreamBody.slice(0, 500) });
			const detail =
				upstreamStatus != null
					? ` upstreamStatus=${upstreamStatus} upstreamBody=${upstreamBody.slice(0, 200)}`
					: "";
			const appleJwtHint =
				apple && upstreamBody.includes("BadJwtToken")
					? " | Apple BadJwtToken: VAPID_SUBJECT reale + chiavi fisse in env; rifai notification.subscribe."
					: "";
			return {
				ok: false as const,
				error: msg,
				logLine: `FAIL ${msg}${detail}${appleJwtHint}`,
			};
		}
	},
});
