import { applyDomProps } from "../../logic/dom-props";
import { toNodes } from "../../logic/children";
import type { DomProps, SharedProps, UiNode } from "../props";

export type IframeProps = SharedProps & {
	src: string;
	title?: string;
	allow?: string;
	referrerPolicy?: HTMLIFrameElement["referrerPolicy"];
	loading?: HTMLIFrameElement["loading"];
};

export function iframe(props: IframeProps): UiNode {
	const el = document.createElement("iframe");
	const { src, title, allow, loading, children, ...rest } = props;
	el.src = src;
	if (title != null) el.title = title;
	if (allow != null) el.setAttribute("allow", allow);
	if (loading != null) el.loading = loading;
	applyDomProps(el, { ...rest, children: undefined } as DomProps);
	toNodes(children);
	return el;
}
