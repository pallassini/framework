/**
 * Processo Bun: RPC su `/_server/*`.
 * Dev: `core/cli/dev/server.ts`. Manuale: `bun core/server/routes/serve.ts`.
 */
import { serverConfig } from "./config";
import { dispatchServerRequest } from "./dispatch";
import { loadServerRoutes } from "./load";
import { tryServeBuiltWeb } from "../../cli/build/static-web";
import { watchServerRoutes } from "./watch";

const prod = process.env.NODE_ENV === "production";

function projectRoot(): string {
	return process.env.FRAMEWORK_PROJECT_ROOT?.trim() || process.cwd();
}

async function main(): Promise<void> {
	const root = projectRoot();
	await loadServerRoutes(root);

	Bun.serve({
		port: serverConfig.port,
		hostname: serverConfig.host,
		async fetch(req) {
			const r = await dispatchServerRequest(req, root);
			if (r != null) return r;
			const web = await tryServeBuiltWeb(req, root);
			if (web != null) return web;
			return new Response("Not Found", { status: 404 });
		},
	});

	if (!prod) watchServerRoutes(root);
}

if (import.meta.main) {
	void main();
}
