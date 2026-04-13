import type { LogConfig } from "../server/config";

export type DesktopConfig = {
	log: LogConfig;
	/**
	 * Base URL RPC in prod (senza slash finale) → `import.meta.env.VITE_SERVER_RPC_ORIGIN`.
	 * Deve essere l’host dove gira `bun core/server/routes/serve.ts` (stesso che logga `[server/routes]`).
	 * In dev il client usa il proxy Vite `/_server`. Override in CI: `VITE_SERVER_RPC_ORIGIN=…`.
	 */
	server?: { url: string };
};

export const desktopConfig: DesktopConfig = {
	server: {
		url: "https://customdb.pallassini.com",
	},
	log: {
		enabled: true,
		detail: "full",
		registryReload: false,
		electrbunDevOutput: false,
		devDesktopSpawnLog: false,
	},
};
