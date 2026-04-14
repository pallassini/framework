import { applyDomProps } from "../../../logic/dom-props";
import type { DomProps, SharedProps, UiNode } from "../../props";

export type CaseProps = SharedProps & {
	when: unknown;
	/**
	 * Preferire `{() => <Figlio />}`: i figli diretti vengono smontati quando il case non matcha;
	 * senza factory si riusano nodi già `dispose` e il contenuto non riappare.
	 */
	children?: unknown;
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
