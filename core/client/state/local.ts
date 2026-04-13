import { toPathname } from "../router/app/routes";
import { signal, type Signal } from "./state/signal";

function normalizePathnameForRoutes(pathname: string): string {
	let p = pathname.replace(/\/index\.html$/i, "");
	if (p === "") p = "/";
	return p;
}

function slotPathFromInput(path: string): string {
	return normalizePathnameForRoutes(toPathname(path));
}

/** Pathname corrente usato come chiave slot (stessa normalizzazione del router). */
export function currentRouteLocalPath(): string {
	if (typeof location === "undefined") return "_";
	return slotPathFromInput(location.pathname);
}

const byPath = new Map<string, Signal<unknown>[]>();
let slotIndex = 0;

/** Chiamato subito prima di montare la page: ordine `local()` = indice slot stabile. */
export function beginRouteLocalFrame(): void {
	slotIndex = 0;
}

/** Dopo navigazione: elimina gli slot delle altre route (evita leak). */
export function pruneRouteLocalsExcept(resolvedPath: string): void {
	const keep = slotPathFromInput(resolvedPath);
	for (const k of [...byPath.keys()]) {
		if (k !== keep) byPath.delete(k);
	}
}

/**
 * Atom reattivo **per route**, stabile tra i re-render (stesso ordine di chiamata ogni volta).
 * Senza argomento: valore iniziale `undefined`, tipo inferibile dall’uso (`local()` → `Signal<unknown | undefined>`).
 * Con valore: `Signal<T>` come `signal(initial)`.
 */
export function local<T = unknown>(): Signal<T | undefined>;
export function local<T>(initial: T): Signal<T>;
export function local<T>(initial?: T): Signal<T | undefined> {
	const path = currentRouteLocalPath();
	let row = byPath.get(path);
	if (!row) {
		row = [];
		byPath.set(path, row);
	}
	const i = slotIndex++;
	if (row[i] === undefined) {
		row[i] =
			initial === undefined
				? (signal(undefined) as Signal<unknown>)
				: (signal(initial) as Signal<unknown>);
	}
	return row[i] as Signal<T | undefined>;
}
