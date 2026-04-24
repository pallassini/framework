import { toPathname } from "../App/routes";

function normalizeForRouter(pathname: string): string {
	let p = pathname.replace(/\/index\.html$/i, "");
	if (p === "") p = "/";
	return p;
}

export const url = {
	origin: () => location.origin,
	pathname: () => location.pathname,
	/** Pathname allineato al router (`getRouteLoader`), utile per match menu / tab attiva. */
	route: () => normalizeForRouter(toPathname(location.pathname)),
	basePath() {
		const b = import.meta.env.BASE_URL ?? "/";
		return b === "/" || b === "" ? "/" : b.endsWith("/") ? b : `${b}/`;
	},
	segments: () => segs(location.pathname),
	segment: (i: number) => segs(location.pathname).at(i),
	searchParams: () => new URLSearchParams(location.search),
};

const segs = (pathname: string) => {
	const t = pathname.replace(/^\/+|\/+$/g, "");
	return t ? t.split("/") : [];
};
