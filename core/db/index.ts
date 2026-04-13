import postgres, { type Sql } from "postgres";
import { dbConfig } from "./config";

export const db: Sql = postgres(dbConfig.url, {
	max: dbConfig.max,
	idle_timeout: dbConfig.idleTimeoutSeconds,
	connect_timeout: dbConfig.connectTimeoutSeconds,
	ssl: dbConfig.ssl,
});

export async function checkDb(): Promise<void> {
	await db`select 1`;
}

export async function closeDb(options?: { timeout?: number }): Promise<void> {
	await db.end({ timeout: options?.timeout });
}
