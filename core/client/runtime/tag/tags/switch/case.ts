import { applyDomProps } from "../../../logic/dom-props";
import type { Signal } from "../../../../state/state";
import type { StyleInput } from "../../../../style";
import type { ClientEvents, DomProps, HoverProp, UiNode } from "../../props";

/**
 * Stesso shape di `SharedProps` ma in un solo tipo con `when` dichiarato qui: se si fa `SharedProps & { when: … }`,
 * l’index `[key: string]: unknown` si combina in modo che JSX non dia tipo contestuale al callback (`v` implicit `any`).
 */
export type CaseProps<T = unknown> = ClientEvents & {
	/**
	 * Preferire `{() => <Figlio />}`: i figli diretti vengono smontati quando il case non matcha;
	 * senza factory si riusano nodi già `dispose` e il contenuto non riappare.
	 */
	children?: unknown;
	hover?: HoverProp;
	s?: StyleInput | false | null | (() => unknown) | Signal<unknown>;
	show?: unknown;
	/**
	 * Match su `<switch value>`. Non usare `T | …` con default `T = unknown`: `unknown` in unione col callback
	 * fa perdere a TS il tipo contestuale e `v` diventa implicit `any`.
	 */
	when: Signal<T> | ((v: T) => unknown) | string | number | boolean | null | undefined;
};

function getWhen(anchor: HTMLElement): unknown {
	return (anchor as HTMLElement & { __fwWhen?: unknown }).__fwWhen;
}

function getCaseChildren(anchor: HTMLElement): unknown {
	return (anchor as HTMLElement & { __fwCaseChildren?: unknown }).__fwCaseChildren;
}

export function caseMeta(anchor: HTMLElement): { when: unknown; children: unknown } {
	return { when: getWhen(anchor), children: getCaseChildren(anchor) };
}

export function clientCase(props: CaseProps): UiNode {
	const anchor = document.createElement("span");
	anchor.setAttribute("data-fw-case", "");
	anchor.style.display = "contents";

	const { when, children, ...rest } = props;
	(anchor as HTMLElement & { __fwWhen?: unknown }).__fwWhen = when;
	(anchor as HTMLElement & { __fwCaseChildren?: unknown }).__fwCaseChildren = children;
	applyDomProps(anchor, rest as DomProps);

	return anchor;
}
