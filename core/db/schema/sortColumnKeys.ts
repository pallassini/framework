/** Pure helper — safe to import from client (no `node:fs`). */

/** `id` first, alphabetical middle, `createdAt` / `updatedAt` last (framework defaults). */
export function sortDbColumnKeys(keys: readonly string[]): string[] {
	const tail = ["createdAt", "updatedAt"] as const;
	const tailSet = new Set<string>(tail);
	const rest = keys
		.filter((k) => k !== "id" && !tailSet.has(k))
		.sort((a, b) => a.localeCompare(b));
	const out: string[] = [];
	if (keys.includes("id")) out.push("id");
	out.push(...rest);
	for (const t of tail) {
		if (keys.includes(t)) out.push(t);
	}
	return out;
}

/**
 * Ordine colonne devtools: prima come nello schema (`db/index.ts` + id/timestamp iniettati),
 * poi eventuali colonne extra (solo dati) con `sortDbColumnKeys`.
 */
export function orderColumnsBySchema(
	schemaOrder: readonly string[] | undefined,
	allKeys: readonly string[],
): string[] {
	const present = new Set(allKeys);
	const out: string[] = [];
	const seen = new Set<string>();
	if (schemaOrder) {
		for (const k of schemaOrder) {
			if (present.has(k) && !seen.has(k)) {
				out.push(k);
				seen.add(k);
			}
		}
	}
	const schemaSet = new Set(schemaOrder ?? []);
	const rest = allKeys.filter((k) => !seen.has(k));
	const extra = rest.filter((k) => !schemaSet.has(k));
	out.push(...sortDbColumnKeys(extra));
	return out;
}
