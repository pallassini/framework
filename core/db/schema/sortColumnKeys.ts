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
