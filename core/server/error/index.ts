export type ErrorType =
	| "INPUT"
	| "NOT_FOUND"
	| "UNAUTHORIZED"
	| "FORBIDDEN"
	| "RATE_LIMIT"
	| "CONCURRENCY_LIMIT"
	| "TIMEOUT"
	| "PAYLOAD_TOO_LARGE"
	| "INTERNAL";

const STATUS: Record<ErrorType, number> = {
	INPUT: 400,
	NOT_FOUND: 404,
	UNAUTHORIZED: 401,
	FORBIDDEN: 403,
	RATE_LIMIT: 429,
	CONCURRENCY_LIMIT: 429,
	TIMEOUT: 408,
	PAYLOAD_TOO_LARGE: 413,
	INTERNAL: 500,
};

const DEFAULT_MESSAGE: Record<ErrorType, string> = {
	INPUT: "Invalid input",
	NOT_FOUND: "Not found",
	UNAUTHORIZED: "Unauthorized",
	FORBIDDEN: "Forbidden",
	RATE_LIMIT: "Too many requests",
	CONCURRENCY_LIMIT: "Too many concurrent requests",
	TIMEOUT: "Request timed out",
	PAYLOAD_TOO_LARGE: "Payload too large",
	INTERNAL: "Internal server error",
};

export class FlowError extends Error {
	readonly type: ErrorType;
	readonly status: number;
	constructor(type: ErrorType, message?: string) {
		super(message ?? DEFAULT_MESSAGE[type]);
		this.type = type;
		this.status = STATUS[type];
		this.name = "FlowError";
	}
}

export function error(type: ErrorType, message?: string): never {
	throw new FlowError(type, message);
}

export function errorResponse(e: unknown): Response {
	if (e instanceof FlowError) {
		return Response.json({ error: { type: e.type, message: e.message } }, { status: e.status });
	}
	const message = e instanceof Error ? e.message : String(e);
	return Response.json({ error: { type: "INTERNAL", message } }, { status: 500 });
}
