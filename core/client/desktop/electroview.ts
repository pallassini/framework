import {
	Electroview,
	type ElectrobunRPCConfig,
	type ElectrobunRPCSchema,
} from "electrobun/view";

let instance: Electroview<any> | undefined;
let rpcUnavailable = false;
let initAttempted = false;

function isElectrobunWebview(): boolean {
	if (typeof window === "undefined") return false;
	const w = window as Window & { __electrobunWebviewId?: unknown };
	return w.__electrobunWebviewId != null && String(w.__electrobunWebviewId) !== "";
}

/** Chiama una volta all’avvio client (es. in `client/index.tsx`). No-op nel browser (Vite) senza Electrobun. */
export function initDesktopRpc(): void {
	if (initAttempted) return;
	initAttempted = true;
	if (!isElectrobunWebview()) {
		rpcUnavailable = true;
		return;
	}
	const rpc = Electroview.defineRPC({
		maxRequestTime: 30_000,
		handlers: { requests: {} },
	} as ElectrobunRPCConfig<ElectrobunRPCSchema, "webview">);
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
