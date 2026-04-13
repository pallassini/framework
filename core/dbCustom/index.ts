import { db } from "../db/index";
import { dbConfig } from "./config";

export type DbCustomSmokeResult = {
	ok: true;
	layer: "dbCustom";
	connection: { host: string; database: string; user: string };
	postgresVersion: string;
	rows: Record<string, unknown>[];
};

function connectionSummary(url: string): { host: string; database: string; user: string } {
	try {
		const u = new URL(url.replace(/^postgresql:\/\//i, "http://"));
		const path = (u.pathname || "").replace(/^\//, "");
		const database = path.split("/")[0] ?? "";
		return {
			host: u.hostname,
			database,
			user: decodeURIComponent(u.username || ""),
		};
	} catch {
		return { host: "?", database: "?", user: "?" };
	}
}

/** Prova end-to-end: stesso client `postgres` di `core/db`, API “custom” sopra. */
export async function smokeTest(): Promise<DbCustomSmokeResult> {
	const [{ version: postgresVersion }] = await db<{ version: string }[]>`
		select version() as version
	`;
	const rows = await db`
		select
			current_database() as database,
			current_user as db_user,
			now() as server_time
	`;
	return {
		ok: true,
		layer: "dbCustom",
		connection: connectionSummary(dbConfig.url),
		postgresVersion,
		rows: rows as Record<string, unknown>[],
	};
}
