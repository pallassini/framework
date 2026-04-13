export type OriginUrl = `${"http" | "https"}://${string}`;
export type CorsRule = "same-origin" | "all" | readonly OriginUrl[];

const defaultAllowHeaders = "Content-Type, Authorization";

function normalizeOrigin(o: string): string {
	return o.replace(/\/$/, "");
}

export function requestUrlOrigin(req: Request): string {
	return new URL(req.url).origin;
}

export function pickAllowOrigin(req: Request, rule: CorsRule): string | null {
	const originHeader = req.headers.get("Origin");
	const serverOrigin = normalizeOrigin(requestUrlOrigin(req));

	if (rule === "all") {
		if (originHeader) return normalizeOrigin(originHeader);
		return "*";
	}

	if (!originHeader) return null;

	const origin = normalizeOrigin(originHeader);

	if (rule === "same-origin") {
		return origin === serverOrigin ? origin : null;
	}

	const list = rule.map(normalizeOrigin);
	if (origin === serverOrigin || list.includes(origin)) return origin;
	return null;
}

function baseCorsHeaders(req: Request, allowOrigin: string): Headers {
	const h = new Headers();
	h.set("Access-Control-Allow-Origin", allowOrigin);
	if (allowOrigin !== "*") h.append("Vary", "Origin");
	h.set("Access-Control-Allow-Methods", "POST, OPTIONS");
	const reqHeaders = req.headers.get("Access-Control-Request-Headers");
	h.set("Access-Control-Allow-Headers", reqHeaders ?? defaultAllowHeaders);
	h.set("Access-Control-Max-Age", "86400");
	return h;
}

export function corsPreflightResponse(req: Request, rule: CorsRule): Response {
	const allow = pickAllowOrigin(req, rule);
	if (!allow) return new Response(null, { status: 403 });
	return new Response(null, { status: 204, headers: baseCorsHeaders(req, allow) });
}

export function withCors(req: Request, res: Response, rule: CorsRule): Response {
	const allow = pickAllowOrigin(req, rule);
	if (!allow) return res;
	const headers = new Headers(res.headers);
	headers.set("Access-Control-Allow-Origin", allow);
	if (allow !== "*") {
		const v = headers.get("Vary");
		headers.set("Vary", v && !/\bOrigin\b/i.test(v) ? `${v}, Origin` : (v ?? "Origin"));
	}
	return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}
