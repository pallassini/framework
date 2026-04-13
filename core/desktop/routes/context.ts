export type DesktopContext = {
	readonly routeName: string;
	rpcLogParts: string[];
	rpcPayloadSizes?: { in: number; out: number };
};
