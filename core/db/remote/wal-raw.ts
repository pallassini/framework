/**
 * Handler raw per il WAL binario:
 *   - `GET  /_server/_admin/db/wal`          → download `wal.log` (application/octet-stream)
 *   - `POST /_server/_admin/db/wal/upload`   → upload `wal.log` (application/octet-stream), riapre il motore
 *
 * Non passano dall'RPC JSON perché il payload è binario (potenzialmente grosso).
 * Auth bearer identico all'RPC admin.
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
	REMOTE_ADMIN_WAL_PATH,
	REMOTE_ADMIN_WAL_UPLOAD_PATH,
} from "./protocol";
import { currentAdminPasswordOrEmpty, isAdminEnabled } from "./server-auth";

function timingSafeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	return diff === 0;
}

function checkBearer(headers: Headers): { ok: true } | { ok: false; status: number; msg: string } {
	if (!isAdminEnabled()) return { ok: false, status: 404, msg: "not found" };
	const pw = currentAdminPasswordOrEmpty();
	const auth = headers.get("authorization") ?? "";
	const prefix = "bearer ";
	if (auth.length < prefix.length || auth.slice(0, prefix.length).toLowerCase() !== prefix) {
		return { ok: false, status: 401, msg: "missing bearer token" };
	}
	const token = auth.slice(prefix.length).trim();
	if (!timingSafeEqual(token, pw)) {
		return { ok: false, status: 401, msg: "invalid token" };
	}
	return { ok: true };
}

/**
 * Gestisce le richieste verso gli endpoint WAL raw.
 * Ritorna `null` se il path non è pertinente (così chi chiama può proseguire col dispatcher normale).
 */
export async function maybeHandleWalRaw(req: Request): Promise<Response | null> {
	const url = new URL(req.url);
	const path = url.pathname;

	if (path !== REMOTE_ADMIN_WAL_PATH && path !== REMOTE_ADMIN_WAL_UPLOAD_PATH) return null;

	const auth = checkBearer(req.headers);
	if (!auth.ok) {
		return Response.json(
			{ ok: false, error: { type: auth.status === 404 ? "NOT_FOUND" : "UNAUTHORIZED", message: auth.msg } },
			{ status: auth.status },
		);
	}

	// Import lazy per evitare di caricare `core/db` in contesti che non lo usano.
	// In modalità FWDB_REMOTE l'import lancerebbe se questo file fosse incluso lato client remoto,
	// ma `serve.ts` esiste solo nel processo server, che è sempre locale.
	const { getDataDir, forceCheckpoint } = (await import("../index")) as typeof import("../index");

	if (path === REMOTE_ADMIN_WAL_PATH) {
		if (req.method !== "GET") {
			return new Response("Method Not Allowed", { status: 405 });
		}
		let dataDir: string;
		try {
			dataDir = getDataDir();
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			return Response.json({ ok: false, error: { type: "INTERNAL", message: msg } }, { status: 500 });
		}
		try {
			forceCheckpoint();
		} catch (e) {
			console.warn("[admin/db/wal] checkpoint fallito prima del dump:", e);
		}
		const walPath = join(dataDir, "wal.log");
		if (!existsSync(walPath)) {
			// WAL vuoto è legittimo (dopo checkpoint): rispondiamo con 200 + body vuoto.
			return new Response(new Uint8Array(0), {
				status: 200,
				headers: { "content-type": "application/octet-stream", "x-fwdb-wal": "empty" },
			});
		}
		const file = Bun.file(walPath);
		return new Response(file, {
			status: 200,
			headers: {
				"content-type": "application/octet-stream",
				"content-disposition": `attachment; filename="wal.log"`,
			},
		});
	}

	if (path === REMOTE_ADMIN_WAL_UPLOAD_PATH) {
		if (req.method !== "POST") {
			return new Response("Method Not Allowed", { status: 405 });
		}
		let dataDir: string;
		try {
			dataDir = getDataDir();
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			return Response.json({ ok: false, error: { type: "INTERNAL", message: msg } }, { status: 500 });
		}
		const bodyBuf = new Uint8Array(await req.arrayBuffer());
		mkdirSync(dataDir, { recursive: true });
		const walPath = join(dataDir, "wal.log");
		writeFileSync(walPath, bodyBuf);
		return Response.json({ ok: true, bytes: bodyBuf.byteLength }, { status: 200 });
	}

	return null;
}
