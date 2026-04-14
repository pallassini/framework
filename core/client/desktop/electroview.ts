import {
	Electroview,
	type ElectrobunRPCConfig,
} from "electrobun/view";

import { FW_DB_SCHEMA_RELOAD_EVENT } from "../../fw-db-schema-reload-event";

export { FW_DB_SCHEMA_RELOAD_EVENT };

type DesktopWebviewRpcSchema = {
	bun: { requests: Record<string, never>; messages: Record<string, never> };
	webview: {
		requests: Record<string, never>;
		messages: { fwDbSchemaReloaded: void };
	};
};

let instance: Electroview<any> | undefined;
let rpcUnavailable = false;
let initAttempted = false;

function isElectrobunWebview(): boolean {
	if (typeof window === "undefined") return false;
	const w = window as Window & { __electrobunWebviewId?: unknown };
	return w.__electrobunWebviewId != null && String(w.__electrobunWebviewId) !== "";
}

/** Side-effect: `core/client/router` (import da `client`). No-op nel browser (Vite) senza Electrobun. */
export function initDesktopRpc(): void {
	if (initAttempted) return;
	initAttempted = true;
	if (!isElectrobunWebview()) {
		rpcUnavailable = true;
		return;
	}
	const rpc = Electroview.defineRPC({
		maxRequestTime: 30_000,
		handlers: {
			requests: {},
			messages: {
				fwDbSchemaReloaded: () => {
					globalThis.dispatchEvent(new Event(FW_DB_SCHEMA_RELOAD_EVENT));
				},
			},
		},
	} as ElectrobunRPCConfig<DesktopWebviewRpcSchema, "webview">);
	instance = new Electroview({ rpc });
}

export function getDesktopElectroview(): Electroview<any> {
	if (!initAttempted) initDesktopRpc();
	if (rpcUnavailable) {
		throw new Error(
			"Desktop RPC non disponibile: avvia l’app con Electrobun (`electrobun dev`), non solo il dev server Vite.",
		);
	}
	if (!instance) {
		throw new Error("Desktop RPC: Electroview non inizializzato.");
	}
	return instance;
}
