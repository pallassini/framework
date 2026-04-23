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

/** Per IP in-memory, route `auth.login` / `auth.register` — vedi `core/server/middlewares/limit.ts`. */
export type AuthRateLimitConfig = { window: number; max: number };

export interface ServerConfig {
  cors: "same-origin" | "all" | readonly `${"http" | "https"}://${string}`[];
  log: LogConfig;
  /** Rate limit condivise (stesso contatore per IP) per le RPC di autenticazione. */
  auth: { rateLimit: AuthRateLimitConfig };
}

export const serverConfig: ServerConfig = {
  auth: {
    rateLimit: {
      window: 120000, // 2 minute
      max: 10, // 10 requests
    },
  },
  cors: "all",
  log: {
    enabled: true,
    detail: "full",
    registryReload: false,
  },
};
