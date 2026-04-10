import type { UiNode } from "../../runtime/tag/props";
import { signal } from "../../state";

export type ClientPage = (props: Record<string, unknown>) => UiNode;

export const emptyRoutePage: ClientPage = () => null;

export const routePhase = signal<"chunk" | "route" | "idle">("idle");

export const routePage = signal<ClientPage>(emptyRoutePage);

export const routeAsyncFallback = signal<ClientPage | null>(null);

export const routeModuleLoading = signal<ClientPage | null>(null);

export function setRoutePage(page: ClientPage): void {
	routePage(() => page);
}

export function setRouteAsyncFallback(fallback: ClientPage | null): void {
	routeAsyncFallback(() => fallback);
}

export function setRouteModuleLoading(loading: ClientPage | null): void {
	routeModuleLoading(() => loading);
}

export function resetRouteUi(): void {
	routePhase("idle");
	setRoutePage(emptyRoutePage);
	setRouteAsyncFallback(null);
	setRouteModuleLoading(null);
}
