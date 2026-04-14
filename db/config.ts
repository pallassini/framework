export type DbLogConfig = {
	enabled: boolean;
	/** `minimal`: una riga sintetica · `full`: pid, tableNames, durata, path */
	detail: "minimal" | "full";
	/** Log al primo `bundleTables` all’import di `core/db`. Default: come `enabled`. */
	boot?: boolean;
	/** Log avvio fs.watch su `db/`. Default: come `enabled`. */
	schemaWatch?: boolean;
	/** Log ogni ricarica schema (successo / errore). Default: come `enabled`. */
	schemaReload?: boolean;
};

export const dbConfig: { log: DbLogConfig } = {
	log: {
		enabled: false,
		detail: "full",
		boot: true,
		schemaWatch: true,
		schemaReload: true,
	},
};
