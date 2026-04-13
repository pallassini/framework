import { corsPreflightResponse, withCors } from "../middlewares/cors";
import { runRpc } from "./rpc/runner";
import { serverConfig } from "./config";
import { loadServerRoutes } from "./load";
import { routeCors, routeRegistry, routesState } from "./state";

const RPC_PREFIX = "/_server/";

export async function dispatchServerRequest(req: Request, projectRoot: string): Promise<Response | null> {
	const path = new URL(req.url).pathname;

	if (!path.startsWith("/_server")) return null;

	const raw = path.startsWith(RPC_PREFIX)
		? path.slice(RPC_PREFIX.length).replace(/^\/+|\/+$/g, "")
		: path.replace(/^\/_server\/?/, "").replace(/^\/+|\/+$/g, "");
	if (!raw) {
		return new Response("Not Found", { status: 404 });
	}
	const name = raw.includes("/") ? raw.replace(/\//g, ".") : raw;
	const cors = routeCors.get(name) ?? serverConfig.cors;

	if (req.method === "OPTIONS") {
		return corsPreflightResponse(req, cors);
	}

	if (req.method !== "POST") {
		return withCors(
			req,
			Response.json(
				{ error: { type: "METHOD_NOT_ALLOWED", message: "Only POST for RPC server routes" } },
				{ status: 405 },
			),
			cors,
		);
	}

	if (!routesState.loaded) {
		await loadServerRoutes(projectRoot);
	}

	const result = await runRpc(name, routeRegistry, req);
	return withCors(req, result.response, cors);
}
