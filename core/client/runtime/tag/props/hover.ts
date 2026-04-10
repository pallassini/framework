import { isSignal, type Signal } from "../../../state";
import { onNodeDispose } from "../../logic/lifecycle";

type El = HTMLElement | SVGElement;

export type HoverProp =
	| Signal<boolean>
	| ((hovered: boolean) => void)
	| { enter?: () => void; leave?: () => void }
	| { true?: () => void; false?: () => void };

export function applyHover(el: El, v: unknown): void {
	if (v == null || v === false) return;

	let onEnter: () => void;
	let onLeave: () => void;

	if (isSignal(v)) {
		const sig = v as unknown as Signal<boolean>;
		onEnter = () => {
			sig(true);
		};
		onLeave = () => {
			sig(false);
		};
	} else if (typeof v === "function") {
		const fn = v as (hovered: boolean) => void;
		onEnter = () => {
			fn(true);
		};
		onLeave = () => {
			fn(false);
		};
	} else if (typeof v === "object") {
		const o = v as Record<string, unknown>;
		const onT = o["true"];
		const onF = o["false"];
		if (onT !== undefined || onF !== undefined) {
			onEnter = () => {
				if (typeof onT === "function") (onT as () => void)();
			};
			onLeave = () => {
				if (typeof onF === "function") (onF as () => void)();
			};
		} else {
			const legacy = v as { enter?: () => void; leave?: () => void };
			onEnter = () => {
				legacy.enter?.();
			};
			onLeave = () => {
				legacy.leave?.();
			};
		}
	} else return;

	const enter = (): void => {
		onEnter();
	};
	const leave = (): void => {
		onLeave();
	};
	el.addEventListener("mouseenter", enter);
	el.addEventListener("mouseleave", leave);
	onNodeDispose(el, () => {
		el.removeEventListener("mouseenter", enter);
		el.removeEventListener("mouseleave", leave);
	});
}
