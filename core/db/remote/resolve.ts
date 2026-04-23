import type { RemoteTarget } from "./client";

/**
 * Registry alias → credenziali. Definito dall'app in `db/config.ts` (`dbConfig.remotes`).
 * Forma: `{ prod: { url: "https://…", password: "…" } }`.
 */
export type RemoteAliasDef = {
	url: string;
	password: string;
};

export type RemoteRegistry = Record<string, RemoteAliasDef>;

function nonEmpty(v: string | undefined): string | undefined {
	if (v == null) return undefined;
	const t = v.trim();
	return t === "" ? undefined : t;
}

/** Carica `dbConfig.remotes` da `db/config.ts`. Se il file manca o non esporta `dbConfig`, ritorna registro vuoto. */
export async function loadRemoteRegistry(projectRoot: string): Promise<RemoteRegistry> {
	const { existsSync } = await import("node:fs");
	const { join } = await import("node:path");
	const { pathToFileURL } = await import("node:url");
	const file = join(projectRoot, "db", "config.ts");
	if (!existsSync(file)) return {};
	try {
		const mod = (await import(pathToFileURL(file).href)) as {
			dbConfig?: { remotes?: RemoteRegistry };
			default?: { remotes?: RemoteRegistry };
		};
		const cfg = mod.dbConfig ?? mod.default;
		const reg = cfg?.remotes;
		if (!reg || typeof reg !== "object") return {};
		return reg;
	} catch (e) {
		console.warn(`[fwdb/remote] impossibile caricare db/config.ts:`, e);
		return {};
	}
}

/** Risolve un alias in target concreto. */
export function resolveRemoteTarget(alias: string, registry: RemoteRegistry): RemoteTarget {
	const def = registry[alias];
	if (!def) {
		const known = Object.keys(registry);
		throw new Error(
			`[fwdb/remote] alias "${alias}" sconosciuto. Definiscilo in db/config.ts → dbConfig.remotes${known.length ? ` (noti: ${known.join(", ")})` : ""}.`,
		);
	}
	const baseUrl = nonEmpty(def.url);
	if (!baseUrl) {
		throw new Error(`[fwdb/remote:${alias}] manca \`url\` in dbConfig.remotes.${alias}.`);
	}
	const password = nonEmpty(def.password);
	if (!password) {
		throw new Error(`[fwdb/remote:${alias}] manca \`password\` in dbConfig.remotes.${alias}.`);
	}
	return { alias, baseUrl, password };
}
