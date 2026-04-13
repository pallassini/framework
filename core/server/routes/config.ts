import type { CorsRule } from "../middlewares/cors";

/** Porta HTTP del processo Bun che espone `/_server/*` (override: `SERVER_RPC_PORT`). */
export const SERVER_RPC_PORT = Number(process.env.SERVER_RPC_PORT ?? 8787);

/** Host di ascolto (override: `SERVER_RPC_HOST`, default loopback). */
export const SERVER_RPC_HOST = process.env.SERVER_RPC_HOST?.trim() || "127.0.0.1";

export type ServerAppConfig = {
	port: number;
	host: string;
	cors: CorsRule;
};

export const serverConfig: ServerAppConfig = {
	port: SERVER_RPC_PORT,
	host: SERVER_RPC_HOST,
	cors: "all",
};
