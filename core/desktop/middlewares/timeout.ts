import { desktopError } from "../error";
import type { DesktopMiddleware } from "./logic/types";

export function timeout(ms: number): DesktopMiddleware {
	return (ctx, next) =>
		Promise.race([
			next(),
			new Promise<never>((_, reject) =>
				setTimeout(() => reject(Object.assign(new Error("Desktop route timed out"), { _timeout: true })), ms),
			),
		]).catch((e) => {
			if ((e as { _timeout?: boolean })._timeout) desktopError("TIMEOUT", "Route timed out");
			throw e;
		});
}
