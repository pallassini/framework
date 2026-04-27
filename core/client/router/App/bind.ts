import { NAVIGATE_EVENT } from "../go";
import { links } from "./links";
import type { RenderOptions } from "./render";
import { toPathname } from "./routes";

/** popstate + evento `go` / link + click su `<a>` interni. */
export function bind(
	rootEl: HTMLElement,
	render: (path: string, opts?: RenderOptions) => void,
): () => void {
	const onPopstate = () => void render(location.pathname);
	/** `go` può passare path+query; il loader route usa solo il pathname (evita 404 su stringhe ambigue). */
	const onNav = (e: Event) => void render(toPathname((e as CustomEvent<string>).detail));
	window.addEventListener("popstate", onPopstate);
	window.addEventListener(NAVIGATE_EVENT, onNav);
	const unlink = links(rootEl);
	return () => {
		window.removeEventListener("popstate", onPopstate);
		window.removeEventListener(NAVIGATE_EVENT, onNav);
		unlink();
	};
}
