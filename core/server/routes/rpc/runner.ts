import type { ServerFn } from "./types";
import { createContext } from "../context";
import { FlowError, errorResponse } from "../../error";
import { routeMeta } from "../state";

const encoder = new TextEncoder();

function jsonResponse(payload: unknown, status = 200): { response: Response; bytes: number } {
	const body = JSON.stringify(payload);
	return {
		response: new Response(body, {
			status,
			headers: { "content-type": "application/json; charset=utf-8" },
		}),
		bytes: encoder.encode(body).byteLength,
	};
}

async function measureResponseBytes(response: Response): Promise<number | null> {
	const header = response.headers.get("content-length");
	if (header) {
		const n = Number(header);
		if (Number.isFinite(n)) return n;
	}
	try {
		const ab = await response.clone().arrayBuffer();
		return ab.byteLength;
	} catch {
		return null;
	}
}

export async function runRpc(name: string, registry: ReadonlyMap<string, ServerFn>, req: Request) {
	const start = Date.now();

	const fn = registry.get(name);
	if (!fn) {
		const out = jsonResponse(
			{ error: { type: "NOT_FOUND", message: `'${name}' not found` } },
			404,
		);
		return { response: out.response, durationMs: Date.now() - start, ok: false as const };
	}

	const maxIn = routeMeta.get(name)?.sizeLimit?.in;

	let rawInput: unknown;
	let requestBytes: number | null = null;
	try {
		const text = await req.text();
		requestBytes = encoder.encode(text).byteLength;
		if (maxIn != null && requestBytes > maxIn) {
			const out = jsonResponse(
				{
					error: {
						type: "PAYLOAD_TOO_LARGE",
						message: `Request body too large (max ${maxIn} bytes)`,
					},
				},
				413,
			);
			return {
				response: out.response,
				durationMs: Date.now() - start,
				ok: false as const,
				requestBytes,
				responseBytes: out.bytes,
			};
		}
		rawInput = text ? (JSON.parse(text) as { input?: unknown })?.input : undefined;
	} catch {
		rawInput = undefined;
	}

	const ctx = createContext(req, name);

	try {
		const value = await fn(rawInput, ctx);
		const out = jsonResponse(value ?? null);
		return {
			response: out.response,
			durationMs: Date.now() - start,
			ok: true as const,
			requestBytes,
			responseBytes: out.bytes,
		};
	} catch (e) {
		const response = errorResponse(e);
		return {
			response,
			durationMs: Date.now() - start,
			ok: e instanceof FlowError && e.status < 500,
			requestBytes,
			responseBytes: await measureResponseBytes(response),
		};
	}
}
