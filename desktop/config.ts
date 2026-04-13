import type { LogConfig } from "../server/config";

export type DesktopConfig = {
	log: LogConfig;
	/**
	 * Base URL RPC (senza slash finale). Usata in build da `core/client/vite.config.ts` → `import.meta.env.VITE_SERVER_RPC_ORIGIN`.
	 * In dev il client usa il proxy `/_server`; in prod (web + Electrobun) le fetch vanno qui.
	 */
	server?: { url: string };
};

export const desktopConfig: DesktopConfig = {
	server: {
		url: "https://test.pallassini.com",
	},
	log: {
		enabled: true,
		detail: "full",
		registryReload: false,
		electrbunDevOutput: false,
		devDesktopSpawnLog: false,
	},
};
