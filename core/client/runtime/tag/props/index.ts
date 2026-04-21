/**
 * Tabella delle prop gestite: una chiave = nome attributo/evento, valore = applicatore sul nodo.
 * Tipi condivisi (per tag e JSX) derivati qui sotto.
 */

import type { Signal } from "../../../state/state";
import type { StyleInput } from "../../../style";
import { id } from "./id";
import { s, hover } from "./style";
import { show } from "./show";
import { clickout } from "./clickout";
import { CLIENT_EVENT_NAMES, eventAppliers } from "./events";
import type { HoverProp } from "./hover";

export type { HoverProp } from "./hover";

export type DomEl = HTMLElement | SVGElement;

export type DomPropApplier = (el: DomEl, v: unknown) => void;

export type UiNode = HTMLElement | SVGElement | Text | DocumentFragment | null | undefined;

export type DomProps = Record<string, unknown> & { children?: unknown };

export type ClientEventName = (typeof CLIENT_EVENT_NAMES)[number];

/** Handler DOM: funzione (anche `async`) oppure Promise/thenable eseguito al click (vedi `normalizeDomEventHandler`). */
export type ClientEvents = {
	[K in ClientEventName]?:
		| ((ev: HTMLElementEventMap[K]) => void | Promise<void>)
		| Promise<unknown>;
};

export type SharedProps = ClientEvents & {
	children?: unknown;
	hover?: HoverProp;
	/**
	 * Stringa token oppure layer `{ base, bg, … }`: dopo `base`, chiavi map con valore statico, `Signal`, `() => …`,
	 * o tupla `[() => boolean, suffisso]` / `[suffisso, () => boolean]` per applicare la proprietà solo quando la condizione è vera.
	 */
	s?: StyleInput | false | null | (() => unknown) | Signal<unknown>;
	/**
	 * Visibilità reattiva: `Signal`, funzione `() => …`, booleano.
	 * Su `<t>` / `<div>` senza `fallback`: smonta/monta **l’elemento** nel DOM (come la prop `show` su `<img>`).
	 * La comparsa/scomparsa rispetta `transition-duration` dell’elemento (es. `var(--duration)` da `base-reset`).
	 * HTML: `opacity` + `max-width` + `max-height` (stessa durata, assi sincroni); SVG: solo `opacity`. Con `prefers-reduced-motion: reduce` è istantaneo.
	 * Con `fallback`: solo i **figli** vengono scambiati (`when` vero → `children`, falso → `fallback`).
	 * I branch viewport sono signal: usa `mob()`, `show={!mob()}`, `show={() => device() === "mob"}`, ecc. (`!mob` da solo è sempre falso: `mob` è una funzione).
	 */
	show?: unknown;
	/**
	 * Click (mousedown, fase capture) fuori da questo elemento → handler.
	 * L’elemento che ha la prop è il confine “dentro”; figli inclusi. `false`/`null` = disattiva.
	 */
	clickout?: ((e: MouseEvent) => void | Promise<void>) | false | null;
	[key: string]: unknown;
};

export const props = {
	id,
	...eventAppliers,
	s,
	hover,
	show,
	clickout,
} as const satisfies Record<string, DomPropApplier>;

export { CLIENT_EVENT_NAMES };
