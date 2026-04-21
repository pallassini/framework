import { onNodeDispose } from "../../logic/lifecycle";

type El = HTMLElement | SVGElement;

/** Oggetto ref classico (come `useRef`): `{ current }` aggiornato a mount e azzerato a dispose. */
export type RefObject<T extends El = El> = { current: T | null };

/**
 * Callback ref: chiamata con l'elemento a mount; se ritorna una funzione, quella è la cleanup su dispose.
 * Altrimenti, a dispose la callback viene richiamata con `null`.
 */
export type RefCallback<T extends El = El> = (el: T | null) => void | (() => void);

export type RefProp<T extends El = El> = RefObject<T> | RefCallback<T> | null | undefined | false;

/** `applyDomProps` può chiamare più volte: un solo controller per elemento. */
const refControllers = new WeakMap<El, { ref: RefProp; cleanup?: () => void }>();

function attachRef(el: El, v: RefProp): void {
	if (v == null || v === false) return;

	let cleanup: (() => void) | undefined;

	if (typeof v === "function") {
		const result = v(el);
		if (typeof result === "function") cleanup = result;
	} else if (typeof v === "object" && "current" in v) {
		(v as RefObject).current = el;
	} else {
		return;
	}

	refControllers.set(el, { ref: v, cleanup });

	onNodeDispose(el, () => {
		const ctl = refControllers.get(el);
		if (!ctl) return;
		refControllers.delete(el);
		if (ctl.cleanup) {
			try {
				ctl.cleanup();
			} catch {
				/* */
			}
		} else if (typeof ctl.ref === "function") {
			try {
				ctl.ref(null);
			} catch {
				/* */
			}
		} else if (ctl.ref != null && typeof ctl.ref === "object" && "current" in ctl.ref) {
			(ctl.ref as RefObject).current = null;
		}
	});
}

/** Prop `ref`: callback o `{ current }`. A mount riceve l'elemento, a dispose viene ripulito (cleanup callback o `.current = null`). */
export function ref(el: El, v: unknown): void {
	const prev = refControllers.get(el);
	if (prev && prev.ref === v) return;
	attachRef(el, v as RefProp);
}
