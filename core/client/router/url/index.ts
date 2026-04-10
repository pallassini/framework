
export const url = {
	origin: () => location.origin,
	pathname: () => location.pathname,
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
