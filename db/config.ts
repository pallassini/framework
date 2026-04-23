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

/** Singolo endpoint remoto raggiungibile dal framework come se fosse il db locale. */
export type RemoteDef = {
	/** URL base del server remoto, es. "https://tuo-dominio.example". */
	url: string;
	/** Password condivisa: deve coincidere con `admin.password` del server remoto. */
	password: string;
};

export type DbAdminConfig = {
	/** Se `true` il server espone `/_server/_admin/db/*`. Impostare `true` in produzione. */
	enabled: boolean;
	/** Password condivisa richiesta via `Authorization: Bearer <password>` per chi chiama l'admin. */
	password: string;
};

export type DbConfig = {
	log: DbLogConfig;
	/** Configurazione degli endpoint admin esposti da questo server. */
	admin: DbAdminConfig;
	/**
	 * Registry dei DB remoti. Ogni alias è usato dai comandi:
	 *   `bun db push --to <alias>`, `bun db pull --from <alias>`,
	 *   `bun dev:remote [<alias>]` (default: "prod").
	 */
	remotes: Record<string, RemoteDef>;
};

export const dbConfig: DbConfig = {
	log: {
		enabled: false,
		detail: "full",
		boot: true,
		schemaWatch: true,
		schemaReload: true,
	},
	admin: {
		enabled: true,
		password: "Pallassini9946.",
	},
	remotes: {
		prod: {
			url: "https://test.pallassini.com",
			password: "Pallassini9946.",
		},
		// Esempio per un secondo progetto:
		// amministrazione: {
		//   url: "https://amministrazione.example",
		//   password: "...",
		// },
	},
};
