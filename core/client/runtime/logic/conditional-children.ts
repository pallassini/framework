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
	return watch(() => {
		const allowed = readWhen(when);
		replaceChildrenWithDispose(el);
		if (allowed) {
			const nodes = toNodes(children);
			if (nodes.length) el.append(...nodes);
		} else if (fallback != null) {
			el.append(...toNodes(fallback));
		}
	});
}
