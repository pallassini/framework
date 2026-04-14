import { watch } from "../../../state/effect";
import { isSignal, type Signal } from "../../../state/state";
import { toNodes } from "../../logic/children";
import { onNodeDispose, replaceChildrenWithDispose } from "../../logic/lifecycle";
import { applyDomProps } from "../../logic/dom-props";
import type { DomProps, SharedProps, UiNode } from "../props";

type UnwrapEachSource<E> = E extends Signal<infer U> ? U : E extends (...args: never[]) => infer R ? R : E;

type ListItemFromRoot<R> = R extends null | undefined
	? never
	: R extends readonly (infer I)[]
		? I
		: R extends { monitors: readonly (infer I)[] }
			? I
			: R extends { monitors: (infer I)[] }
				? I
				: R extends { displays: readonly (infer I)[] }
					? I
					: R extends { displays: (infer I)[] }
						? I
						: R extends object
							? R
							: unknown;

export type ForEachItem<E> = ListItemFromRoot<NonNullable<UnwrapEachSource<E>>>;

type ForChildrenFn<E> = {
	bivarianceHack(item: ForEachItem<E>, index: number): unknown;
}["bivarianceHack"];

export type ForProps<E = unknown> = SharedProps & {
	each?: E;
	/** Opzionale: deriva la lista da `root` (valore corrente di `each`). Senza `pick`, array / `monitors` / `displays` / oggetto plain → una riga. */
	pick?: (root: UnwrapEachSource<E> | null | undefined) => readonly unknown[] | null | undefined;
	children?: ForChildrenFn<E>;
};

function readRoot(each: unknown): unknown {
	if (each == null) return undefined;
	if (isSignal(each)) return (each as Signal<unknown>)();
	if (typeof each === "function") return (each as () => unknown)();
	return each;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
	return typeof v === "object" && v !== null && Object.getPrototypeOf(v) === Object.prototype;
}

function toIterableList(v: unknown): readonly unknown[] {
	if (v == null) return [];
	if (Array.isArray(v)) return v;
	if (typeof v === "object" && v !== null) {
		if ("displays" in v) {
			const d = (v as { displays: unknown }).displays;
			if (Array.isArray(d)) return d;
		}
		if ("monitors" in v) {
			const m = (v as { monitors: unknown }).monitors;
			if (Array.isArray(m)) return m;
		}
		if ("tables" in v) {
			const t = (v as { tables: unknown }).tables;
			if (Array.isArray(t)) return t;
			if (isPlainObject(t)) {
				return Object.keys(t)
					.sort((a, b) => a.localeCompare(b))
					.map((name) => ({ name, ...(t as Record<string, Record<string, unknown>>)[name]! }));
			}
		}
		if (isPlainObject(v)) return [v];
	}
	return [];
}

function readEachList(
	each: unknown,
	pick?: (root: unknown) => readonly unknown[] | null | undefined,
): readonly unknown[] {
	const root = readRoot(each);
	if (pick != null) {
		const out = pick(root);
		return Array.isArray(out) ? out : [];
	}
	return toIterableList(root);
}

function getRenderer(children: unknown): ((item: unknown, index: number) => unknown) | null {
	if (typeof children === "function") return children as (item: unknown, index: number) => unknown;
	if (Array.isArray(children)) {
		for (const c of children) {
			if (typeof c === "function") return c as (item: unknown, index: number) => unknown;
		}
	}
	return null;
}

export function clientFor(props: ForProps<unknown>): UiNode {
	const anchor = document.createElement("span");
	anchor.setAttribute("data-fw-for", "");
	anchor.style.display = "contents";

	const { each, pick, children, ...rest } = props;
	applyDomProps(anchor, rest as DomProps);

	const dispose = watch(() => {
		const list = readEachList(each, pick);
		const render = getRenderer(children);
		replaceChildrenWithDispose(anchor);
		if (render == null) return;
		for (let i = 0; i < list.length; i++) {
			const item = list[i];
			const branch = render(item, i);
			const nodes = toNodes(branch);
			if (nodes.length) anchor.append(...nodes);
		}
	});
	onNodeDispose(anchor, dispose);

	return anchor;
}

/** Variante PascalCase: stesso comportamento di `<for>`, con `ForProps<E>` per inferenza su `children`. */
export function For<E>(props: ForProps<E>): UiNode {
	return clientFor(props as ForProps<unknown>);
}
