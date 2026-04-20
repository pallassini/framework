import { watch } from "../../../state/effect";
import { isSignal, type AutoSignal, type Signal } from "../../../state/state";
import { toNodes } from "../../logic/children";
import { onNodeDispose, replaceChildrenWithDispose } from "../../logic/lifecycle";
import { applyDomProps } from "../../logic/dom-props";
import type { DomProps, SharedProps, UiNode } from "../props";

type UnwrapEachSource<E> = E extends AutoSignal<infer U>
	? U
	: E extends Signal<infer U>
		? U
		: E extends (...args: never[]) => infer R
			? R
			: E;

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
	/** Se la lista è vuota, monta questo contenuto al posto di nessuna riga. */
	fallback?: unknown;
	/**
	 * `s` applicato a un `<div>` che avvolge ogni elemento della lista.
	 * Serve con **più funzioni** `children` (root affiancati) e più righe in colonna (es. `row gapx-0.2vw`).
	 */
	wrap?: string | false;
	/** Una funzione `(item, i) => …` oppure **più funzioni** come figli JSX (stesso elenco senza `<>…</>`). */
	children?: ForChildrenFn<E> | readonly ForChildrenFn<E>[];
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

function collectItemRenderFns(children: unknown): Array<(item: unknown, index: number) => unknown> {
	if (children == null || children === false) return [];
	if (typeof children === "function") return [children as (item: unknown, index: number) => unknown];
	if (Array.isArray(children)) {
		const out: Array<(item: unknown, index: number) => unknown> = [];
		for (const c of children) {
			if (c == null || c === false) continue;
			out.push(...collectItemRenderFns(c));
		}
		return out;
	}
	return [];
}

function getRenderer(children: unknown): ((item: unknown, index: number) => unknown) | null {
	const fns = collectItemRenderFns(children);
	if (fns.length === 0) return null;
	if (fns.length === 1) return fns[0]!;
	return (item, index) => fns.map((fn) => fn(item, index));
}

export function clientFor(props: ForProps<unknown>): UiNode {
	const anchor = document.createElement("span");
	anchor.setAttribute("data-fw-for", "");
	anchor.style.display = "contents";

	const { each, pick, fallback, wrap, children, ...rest } = props;
	applyDomProps(anchor, rest as DomProps);

	const dispose = watch(() => {
		const list = readEachList(each, pick);
		const render = getRenderer(children);
		replaceChildrenWithDispose(anchor);
		if (list.length === 0 && fallback != null) {
			const fb = toNodes(fallback);
			if (fb.length) anchor.append(...fb);
			return;
		}
		if (render == null) return;
		for (let i = 0; i < list.length; i++) {
			const item = list[i];
			const branch = render(item, i);
			let nodes = toNodes(branch);
			if (wrap != null && wrap !== false && nodes.length) {
				const line = document.createElement("div");
				applyDomProps(line, { s: wrap } as DomProps);
				line.append(...nodes);
				nodes = [line];
			}
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
