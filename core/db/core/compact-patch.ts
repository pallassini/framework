/**
 * PATCH: `undefined` significa “non toccare il campo”, non “imposta undefined”.
 * Gli input `partial` del validator mettono `undefined` per ogni chiave assente dal payload;
 * senza questo passaggio il merge `{ ...row, ...patch }` cancella colonne esistenti.
 */
export function compactUndefinedKeys<T extends Record<string, unknown>>(patch: T): Partial<T> {
	const out: Record<string, unknown> = {};
	for (const [k, v] of Object.entries(patch)) {
		if (v !== undefined) out[k] = v;
	}
	return out as Partial<T>;
}
