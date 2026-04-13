export type DbConfig = {
	url: string;
	max: number;
	idleTimeoutSeconds: number;
	connectTimeoutSeconds: number;
	ssl: "require" | undefined;
};

function readNumber(name: string, fallback: number): number {
	const raw = process.env[name]?.trim();
	if (!raw) return fallback;
	const n = Number(raw);
	return Number.isFinite(n) && n > 0 ? n : fallback;
}

function readSslMode(): "require" | undefined {
	const raw = process.env.DB_SSL?.trim().toLowerCase();
	return raw === "require" ? "require" : undefined;
}

/** Raggiungibile solo tra container sulla stessa rete Docker (es. Dokploy). */
const defaultInternalUrl = "postgresql://admin:prova@test-test-1diryn:5432/prova";

/** Da PC in dev: host pubblico / tunnel (se `DATABASE_URL` non è impostata). */
const defaultDevUrl = "postgresql://admin:prova@37.27.11.151:5432/prova";

function defaultUrlByEnv(): string {
	const prod =
		process.env.NODE_ENV === "production" || process.env.BUN_ENV === "production";
	return prod ? defaultInternalUrl : defaultDevUrl;
}

export const dbConfig: DbConfig = {
	/** In prod conviene sempre impostare `DATABASE_URL` in Dokploy; il fallback usa l’internal host. */
	url: process.env.DATABASE_URL?.trim() || defaultUrlByEnv(),
	max: readNumber("DB_POOL_MAX", 10),
	idleTimeoutSeconds: readNumber("DB_IDLE_TIMEOUT_S", 20),
	/** Remoto spesso >10s se rete/firewall lenti; override con `DB_CONNECT_TIMEOUT_S`. */
	connectTimeoutSeconds: readNumber("DB_CONNECT_TIMEOUT_S", 30),
	ssl: readSslMode(),
};
