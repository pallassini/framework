import type { UiNode } from "../../runtime/tag/props";

export type Component<P = Record<string, unknown>> = (_props: P) => UiNode;
export type Shell = (Page: Component) => UiNode;
