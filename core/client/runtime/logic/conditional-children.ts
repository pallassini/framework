import { watch } from "../../state/effect";
import { toNodes } from "./children";
import { replaceChildrenWithDispose } from "./lifecycle";
import { readWhen } from "./read-when";

/**
 * Come il tag `<show>`: `readWhen(when)` e figli montati solo se vero; opzionale `fallback`.
 * Ritorna il dispose del `watch`.
 */
export function watchConditionalChildren(
	el: HTMLElement,
	when: unknown,
	children: unknown,
	fallback?: unknown,
): () => void {
	// `children` / `fallback` sono DOM nodes preesistenti (con watch di stili, eventi, ecc.).
	// Swappare i figli solo quando il ramo cambia: altrimenti `replaceChildrenWithDispose`
	// dispone gli stili del ramo correntemente mostrato e al ritick lo si rimonta “nudo”.
	let prev: "unset" | "on" | "off" = "unset";
	return watch(() => {
		const allowed = readWhen(when);
		const next: "on" | "off" = allowed ? "on" : "off";
		if (next === prev) return;
		prev = next;
		replaceChildrenWithDispose(el);
		if (allowed) {
			const nodes = toNodes(children);
			if (nodes.length) el.append(...nodes);
		} else if (fallback != null) {
			el.append(...toNodes(fallback));
		}
	});
}
