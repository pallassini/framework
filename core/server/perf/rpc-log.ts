import { desktopConfig } from "../../../desktop/config";
import { serverConfig } from "../../../server/config";
import { collectDesktopRpcMiddlewareLogParts } from "../../desktop/middlewares/rpc-log-collect";
import { collectServerRpcMiddlewareLogParts } from "../middlewares/rpc-log-collect";
import type { DesktopContext } from "../../desktop/routes/context";
import type { ServerContext } from "../routes/context";
import { FlowError, type ErrorType } from "../error";
import { DEV_THEME } from "./dev-theme";
import { formatBytesHuman } from "./payload-metrics";
import { formatElapsedSince } from "./format-elapsed";

const ANSI_MUTED = "\x1b[90m\x1b[2m";
const ANSI_RESET = "\x1b[0m";

function ansiEnabled(): boolean {
	return process.env.NO_COLOR === undefined;
}

function mutedTag(kind: "server" | "desktop"): string {
	const t = `[${kind}]`;
	if (!ansiEnabled()) return t;
	return `${ANSI_MUTED}${t}${ANSI_RESET}`;
}

function mutedFaint(s: string): string {
	if (!ansiEnabled() || s === "") return s;
	return `${ANSI_MUTED}${s}${ANSI_RESET}`;
}

function rpcOpts(kind: "server" | "desktop") {
	return kind === "server" ? serverConfig.log : desktopConfig.log;
}

function formatPayloadBlock(sizes: { in: number; out: number }, useAnsi: boolean): string {
	const inB = formatBytesHuman(sizes.in);
	const outB = formatBytesHuman(sizes.out);
	if (!useAnsi) {
		return `in ${inB} · out ${outB}`;
	}
	const T = DEV_THEME;
	const d = `${T.magenta}\u25c6${T.reset}`;
	return (
		`${d} ${T.magentaBold}in${T.reset} ${T.magenta}${inB}${T.reset}  ` +
		`${d} ${T.magentaBold}out${T.reset} ${T.magenta}${outB}${T.reset}`
	);
}

function buildDetails(
	ctx: { rpcLogParts: string[]; rpcPayloadSizes?: { in: number; out: number } },
	mwLine: string,
	detail: "minimal" | "full",
	useAnsi: boolean,
): string {
	if (detail === "minimal") return "";
	const chunks: string[] = [];
	if (ctx.rpcPayloadSizes) {
		chunks.push(formatPayloadBlock(ctx.rpcPayloadSizes, useAnsi));
	}
	const core = ctx.rpcLogParts.filter(Boolean).join(" · ");
	if (core) chunks.push(useAnsi ? `${DEV_THEME.dim}${core}${DEV_THEME.reset}` : core);
	const mw = mwLine ? (useAnsi ? mutedFaint(mwLine) : mwLine) : "";
	if (mw) chunks.push(mw);
	return chunks.filter(Boolean).join("  ");
}

export function logRpcSuccess(kind: "server" | "desktop", ctx: ServerContext | DesktopContext, t0: number): void {
	const opts = rpcOpts(kind);
	if (!opts.enabled) return;

	const useAnsi = ansiEnabled();
	const elapsed = formatElapsedSince(t0);
	const mwLine =
		opts.detail === "full"
			? kind === "server"
				? collectServerRpcMiddlewareLogParts(ctx as ServerContext)
				: collectDesktopRpcMiddlewareLogParts(ctx as DesktopContext)
			: "";
	const details = buildDetails(ctx, mwLine, opts.detail, useAnsi);
	const T = DEV_THEME;
	const head = useAnsi
		? `${mutedTag(kind)} ${T.magentaBold}${ctx.routeName}${T.reset} ${T.dim}· ${elapsed}${T.reset}`
		: `${mutedTag(kind)} ${ctx.routeName} · ${elapsed}`;
	console.log(details ? `${head}  ${details}` : head);
}

/** Etichette dev (non abbreviate) per `FlowError.type`. */
const FLOW_ERROR_LOG_LABEL: Record<ErrorType, string> = {
	INPUT: "Input validation",
	NOT_FOUND: "Not found",
	UNAUTHORIZED: "Unauthorized",
	FORBIDDEN: "Forbidden",
	RATE_LIMIT: "Rate limit",
	CONCURRENCY_LIMIT: "Concurrency limit",
	TIMEOUT: "Timeout",
	PAYLOAD_TOO_LARGE: "Payload too large",
	INTERNAL: "Internal error",
};

/** Coda breve dopo la categoria (`resets in 3s`, messaggio custom, …). */
function formatCompactErrorTail(
	err: FlowError,
	ctx: ServerContext | DesktopContext,
	kind: "server" | "desktop",
): string {
	if (kind === "server") {
		const sx = ctx as ServerContext;
		switch (err.type) {
			case "RATE_LIMIT": {
				const resetAt = sx.rateLimitState?.resetAt;
				if (resetAt == null) return "window rolling";
				const sec = Math.max(0, Math.ceil((resetAt - Date.now()) / 1000));
				return sec <= 0 ? "resets in <1s" : `resets in ${sec}s`;
			}
			case "TIMEOUT":
				return sx.rpcTimeoutMs != null ? `limit was ${sx.rpcTimeoutMs}ms` : "limit exceeded";
			case "CONCURRENCY_LIMIT":
				return "retry shortly";
			case "INPUT":
			case "PAYLOAD_TOO_LARGE":
			case "NOT_FOUND":
			case "INTERNAL":
				return (err.message || "").trim() || FLOW_ERROR_LOG_LABEL[err.type].toLowerCase();
			case "UNAUTHORIZED":
				return "auth required";
			case "FORBIDDEN":
				return "not allowed";
			default:
				return (err.message || "").trim();
		}
	}
	return (err.message || "").trim() || FLOW_ERROR_LOG_LABEL[err.type].toLowerCase();
}

const DOT = " · ";

/** Una riga compatta: `[server] route · elapsed · Rate limit · resets in 3s` (niente stack, niente mw extra). */
export function logRpcError(
	kind: "server" | "desktop",
	ctx: ServerContext | DesktopContext,
	t0: number,
	err: unknown,
): void {
	const opts = rpcOpts(kind);
	if (!opts.enabled) return;

	const useAnsi = ansiEnabled();
	const elapsed = formatElapsedSince(t0);
	const T = DEV_THEME;

	if (err instanceof FlowError) {
		const label = FLOW_ERROR_LOG_LABEL[err.type];
		const tail = formatCompactErrorTail(err, ctx, kind);
		if (useAnsi) {
			const p1 = `${mutedTag(kind)} ${T.errRoute}${ctx.routeName}${T.reset}`;
			const p2 = `${T.dim}${elapsed}${T.reset}`;
			const p3 = `${T.errCategory}${label}${T.reset}`;
			const p4 = mutedFaint(tail);
			console.log([p1, p2, p3, p4].join(DOT));
		} else {
			console.log(`[${kind}] ${ctx.routeName}${DOT}${elapsed}${DOT}${label}${DOT}${tail}`);
		}
		return;
	}

	const msg = err instanceof Error ? err.message : String(err);
	if (useAnsi) {
		const p1 = `${mutedTag(kind)} ${T.errRoute}${ctx.routeName}${T.reset}`;
		const p2 = `${T.dim}${elapsed}${T.reset}`;
		const p3 = `${T.errCategory}Error${T.reset}`;
		const p4 = mutedFaint(msg);
		console.log([p1, p2, p3, p4].join(DOT));
	} else {
		console.log(`[${kind}] ${ctx.routeName}${DOT}${elapsed}${DOT}Error${DOT}${msg}`);
	}
}
