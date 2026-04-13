import type { ServerContext } from "../routes/context";
import { serverRpcLogPart as cachePart } from "./cache";
import { serverRpcLogPart as concurrencyPart } from "./concurrency";
import { serverRpcLogPart as rateLimitPart } from "./limit";

/**
 * Raccoglie i frammenti definiti nei singoli middleware server.
 * Aggiungi qui l’import quando crei un nuovo middleware con `serverRpcLogPart`.
 */
export function collectServerRpcMiddlewareLogParts(ctx: ServerContext): string {
	return [rateLimitPart(ctx), cachePart(ctx), concurrencyPart(ctx)].filter(Boolean).join(" · ");
}
