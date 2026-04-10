import { go } from "../go";

/** Intercetta click su link interni e usa `go` (stesso flusso della history). */
export function links(root: Element): () => void {
	const onClick = (e: Event) => {
		const a = (e.target as Element).closest("a[href]") as HTMLAnchorElement | null;
		if (!a || a.hasAttribute("data-external") || a.target) return;
		const u = new URL(a.href, location.origin);
		if (u.origin !== location.origin) return;
		e.preventDefault();
		go(u.pathname + u.search + u.hash);
	};
	root.addEventListener("click", onClick);
	return () => root.removeEventListener("click", onClick);
}
