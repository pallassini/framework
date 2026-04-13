import {
	Electroview,
	type ElectrobunRPCConfig,
	type ElectrobunRPCSchema,
} from "electrobun/view";

let instance: Electroview<any> | undefined;

/** Chiama una volta all’avvio client (es. in `client/index.tsx`) per agganciare il canale RPC con il main Bun. */
export function initDesktopRpc(): void {
	if (instance) return;
	const rpc = Electroview.defineRPC({
		maxRequestTime: 30_000,
		handlers: { requests: {} },
	} as ElectrobunRPCConfig<ElectrobunRPCSchema, "webview">);
	instance = new Electroview({ rpc });
}

export function getDesktopElectroview(): Electroview<any> {
	if (!instance) initDesktopRpc();
	return instance!;
}
