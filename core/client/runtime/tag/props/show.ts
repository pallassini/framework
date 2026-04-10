import { watch } from "../../../state";
import { onNodeDispose } from "../../logic/lifecycle";
import { readWhen } from "../../logic/read-when";

type El = HTMLElement | SVGElement;

/** Prop `show` su elementi nativi: mount/unmount nel DOM. */
function applyShow(el: El, v: unknown): void {
	const placeholder = document.createComment("");
	let mounted = true;
	let rafId = 0;
	let queued = false;

	const sync = (): void => {
		const active = readWhen(v);
		if (active && !mounted) {
			if (placeholder.parentNode) {
				placeholder.replaceWith(el);
				mounted = true;
			}
		} else if (!active && mounted) {
			if (el.parentNode) {
				el.replaceWith(placeholder);
				mounted = false;
			}
		}
	};

	const dispose = watch(() => {
		readWhen(v);
		sync();
		if (queued) return;
		queued = true;
		queueMicrotask(() => {
			queued = false;
			sync();
			if (rafId) cancelAnimationFrame(rafId);
			rafId = requestAnimationFrame(() => {
				rafId = 0;
				sync();
			});
		});
		return () => {
			if (rafId) cancelAnimationFrame(rafId);
			rafId = 0;
			queued = false;
		};
	});
	onNodeDispose(el, dispose);
}

export function show(el: El, v: unknown): void {
	applyShow(el, v);
}
