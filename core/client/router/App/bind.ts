import { NAVIGATE_EVENT } from "../go";
import { links } from "./links";
import type { RenderOptions } from "./render";

/** popstate + evento `go` / link + click su `<a>` interni. */
export function bind(
	rootEl: HTMLElement,
	render: (path: string, opts?: RenderOptions) => void,
): () => void {
	const onPopstate = () => void render(location.pathname);
	const onNav = (e: Event) => void render((e as CustomEvent<string>).detail);
	window.addEventListener("popstate", onPopstate);
	window.addEventListener(NAVIGATE_EVENT, onNav);
	const unlink = links(rootEl);
	return () => {
		window.removeEventListener("popstate", onPopstate);
		window.removeEventListener(NAVIGATE_EVENT, onNav);
		unlink();
	};
}
