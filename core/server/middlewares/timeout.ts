import { error } from "../error";
import type { Middleware } from "./logic/types";

export function timeout(ms: number): Middleware {
	return (ctx, next) => {
		ctx.rpcTimeoutMs = ms;
		return Promise.race([
			next(),
			new Promise<never>((_, reject) =>
				setTimeout(() => reject(Object.assign(new Error("Request timed out"), { _timeout: true })), ms),
			),
		]).catch((e) => {
			if ((e as { _timeout?: boolean })._timeout) error("TIMEOUT", "Request timed out");
			throw e;
		});
	};
}
