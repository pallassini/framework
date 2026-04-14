import { dbConfig } from "../../db/config";

const pid = typeof process !== "undefined" ? process.pid : 0;

function allow(kind: "boot" | "schemaWatch" | "schemaReload"): boolean {
	const L = dbConfig.log;
	if (!L.enabled) return false;
	const flag = L[kind];
	return flag !== false;
}

/** Log diagnostici DB (stesso `db/config.ts` in server e processo desktop). */
export function dbLog(
	kind: "boot" | "schemaWatch" | "schemaReload",
	tag: string,
	message: string,
	extra?: Record<string, unknown>,
): void {
	if (!allow(kind)) return;

	const detail = dbConfig.log.detail;
	const prefix = "[db]";
	if (detail === "minimal") {
		console.log(`${prefix} ${tag} ${message}`);
		return;
	}
	console.log(`${prefix} ${tag} ${message}`, { pid, ...extra });
}
