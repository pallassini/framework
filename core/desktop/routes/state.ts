export const desktopRouteRegistry = new Map<string, (raw: unknown) => Promise<unknown>>();

export const desktopRoutesState = {
	loaded: false as boolean,
};
