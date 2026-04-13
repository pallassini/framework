export type LogConfig = {
	enabled: boolean;
	/** `minimal`: solo tag, route, durata · `full`: dimensioni in/out + contributi middleware */
	detail: "minimal" | "full";
	/** Log quando il watcher ricarica `server/routes` (o `desktop/routes` sul config desktop). Default true. */
	registryReload?: boolean;
	/** Solo CLI `electrobun dev`: mostra LAUNCHER / WebView2 / Bridge in terminale. Default true. */
	electrbunDevOutput?: boolean;
	/** CLI: una riga su ogni `d` (pid, conteggio spawn). Default true. Indipendente da `electrbunDevOutput`. */
	devDesktopSpawnLog?: boolean;
};

export interface ServerConfig {
	cors: "same-origin" | "all" | readonly `${"http" | "https"}://${string}`[];
	log: LogConfig;
}

export const serverConfig: ServerConfig = {
	cors: "same-origin",
	log: {
		enabled: true,
		detail: "full",
		registryReload: false,
	},
};
