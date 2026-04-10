/**
 * Tabella delle prop gestite: una chiave = nome attributo/evento, valore = applicatore sul nodo.
 * Tipi condivisi (per tag e JSX) derivati qui sotto.
 */

import { id } from "./id";
import { s, hover } from "./style";
import { show } from "./show";
import { CLIENT_EVENT_NAMES, eventAppliers } from "./events";
import type { HoverProp } from "./hover";

export type { HoverProp } from "./hover";

export type DomEl = HTMLElement | SVGElement;

export type DomPropApplier = (el: DomEl, v: unknown) => void;

export type UiNode = HTMLElement | SVGElement | Text | DocumentFragment | null | undefined;

export type DomProps = Record<string, unknown> & { children?: unknown };

export type ClientEventName = (typeof CLIENT_EVENT_NAMES)[number];

export type ClientEvents = {
	[K in ClientEventName]?: (ev: HTMLElementEventMap[K]) => void;
};

export type SharedProps = ClientEvents & {
	children?: unknown;
	hover?: HoverProp;
	/** Classe CSS (shorthand compat IDE). */
	s?: string | number | false | null;
	/** Visibilità reattiva (prop su qualsiasi elemento). */
	show?: unknown;
	[key: string]: unknown;
};

export const props = {
	id,
	...eventAppliers,
	s,
	hover,
	show,
} as const satisfies Record<string, DomPropApplier>;

export { CLIENT_EVENT_NAMES };
