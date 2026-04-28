import type { CorsRule } from "../middlewares/cors";

/**
 * Porta HTTP (`/_server/*` + static da `build/web`).
 * `SERVER_RPC_PORT` ha priorità; altrimenti `PORT` (molti host / Traefik); default 8787.
 * In dev è letta a runtime così `bun dev` può assegnare una porta libera prima di avviare RPC/Vite.
 */
export function getServerRpcPort(): number {
	return Number(process.env.SERVER_RPC_PORT ?? process.env.PORT ?? 8787);
}

/**
 * Host di ascolto. In produzione default `0.0.0.0` così Traefik/Docker possono collegarsi;
 * in dev resta loopback salvo override `SERVER_RPC_HOST`.
 */
export const SERVER_RPC_HOST =
	process.env.SERVER_RPC_HOST?.trim() ||
	(process.env.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1");

export type ServerAppConfig = {
	port: number;
	host: string;
	cors: CorsRule;
};

export const serverConfig: ServerAppConfig = {
	get port() {
		return getServerRpcPort();
	},
	host: SERVER_RPC_HOST,
	cors: "all",
};
