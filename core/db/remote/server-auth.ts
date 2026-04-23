import { dbConfig } from "../../../db/config";
import { error } from "../../server/error";

/** Confronto stringhe in tempo costante (anti timing-attack). */
function timingSafeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	return diff === 0;
}

/** Legge la password admin dalla config. Se admin non è abilitato o la password è vuota → `null`. */
function adminPassword(): string | null {
	const admin = dbConfig.admin;
	if (!admin || admin.enabled !== true) return null;
	const pw = (admin.password ?? "").trim();
	if (!pw) return null;
	return pw;
}

/** True se l'endpoint admin è abilitato in questo processo. */
export function isAdminEnabled(): boolean {
	return adminPassword() !== null;
}

/**
 * Verifica `Authorization: Bearer <password>` contro `dbConfig.admin.password`.
 * Se admin è disabilitato → 404-like (NOT_FOUND) per non rivelare l'esistenza.
 * Se token mancante / errato → 401.
 */
export function assertAdminAuth(headers: Headers): void {
	const pw = adminPassword();
	if (pw == null) {
		error("NOT_FOUND", "not found");
	}
	const auth = headers.get("authorization") ?? "";
	const prefix = "bearer ";
	if (auth.length < prefix.length || auth.slice(0, prefix.length).toLowerCase() !== prefix) {
		error("UNAUTHORIZED", "missing bearer token");
	}
	const token = auth.slice(prefix.length).trim();
	if (!timingSafeEqual(token, pw)) {
		error("UNAUTHORIZED", "invalid token");
	}
}

/** La password admin effettiva (o stringa vuota se disabilitato). Usata dagli handler raw (wal). */
export function currentAdminPasswordOrEmpty(): string {
	return adminPassword() ?? "";
}
