export function desktopError(type: string, message: string): never {
	const e = Object.assign(new Error(message), { type, __desktopApi: true as const });
	throw e;
}
