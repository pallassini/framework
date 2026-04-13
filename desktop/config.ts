import type { LogConfig } from "../server/config";

export type DesktopConfig = {
	log: LogConfig;
};

export const desktopConfig: DesktopConfig = {
	log: {
		enabled: true,
		detail: "full",
		registryReload: false,
		electrbunDevOutput: false,
		devDesktopSpawnLog: false,
	},
};
