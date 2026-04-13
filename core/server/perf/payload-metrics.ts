const enc = new TextEncoder();

/** Lunghezza UTF-8 del JSON del valore (payload logico RPC). `undefined` → 0. */
export function rpcJsonUtf8Length(v: unknown): number {
	if (v === undefined) return 0;
	try {
		const s = JSON.stringify(v);
		return enc.encode(s).byteLength;
	} catch {
		return 0;
	}
}

export function formatBytesHuman(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes >= 10 * 1024 ? 1 : 2)} KiB`;
	return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`;
}
