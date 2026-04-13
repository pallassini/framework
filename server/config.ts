export type LogConfig = {
	enabled: boolean;
	/** `minimal`: solo tag, route, durata · `full`: dimensioni in/out + contributi middleware */
	detail: "minimal" | "full";
	/** Log quando il watcher ricarica `server/routes` (o `desktop/routes` sul config desktop). Default true. */
	registryReload?: boolean;
	/**
	 * CLI `electrobun dev`: se `false`, nasconde WebView2/Bridge/ecc.
	 * Con `log.enabled` le righe RPC `[desktop] …` passano comunque (filtrate); con `log.enabled: false` lo stdio del child è ignorato del tutto.
	 * Omesso o `true`: tutto lo stdio ereditato (comportamento rumoroso).
	 */
	electrbunDevOutput?: boolean;
	/** CLI: una riga su ogni `d` (pid, conteggio spawn). Default true. Indipendente da `electrbunDevOutput`. */
	devDesktopSpawnLog?: boolean;
};

export interface ServerConfig {
	cors: "same-origin" | "all" | readonly `${"http" | "https"}://${string}`[];
	log: LogConfig;
}

export const serverConfig: ServerConfig = {
	/** Se il frontend è su un altro sottodominio dell’API, aggiungi l’origin qui (o `all`). */
	cors: ["https://test.pallassini.com", "https://customdb.pallassini.com"],
	log: {
		enabled: true,
		detail: "full",
		registryReload: false,
	},
};
