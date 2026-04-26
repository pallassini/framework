import { db } from "db";
import { error } from "server";

export async function assertItemCategory(
	userId: string,
	categoryId: string | undefined | null,
): Promise<void> {
	if (categoryId == null) return;
	const rows = await db.itemCategories.find({ where: { id: categoryId, userId } });
	if (rows.length === 0) error("NOT_FOUND", `itemCategory ${categoryId}`);
}

export async function assertResource(
	userId: string,
	resourceId: string | undefined | null,
): Promise<void> {
	if (resourceId == null) return;
	const rows = await db.resources.find({ where: { id: resourceId, userId } });
	if (rows.length === 0) error("NOT_FOUND", `resource ${resourceId}`);
}

export async function assertResources(
	userId: string,
	resourceIds: readonly string[] | undefined | null,
) {
	if (resourceIds == null) return;
	await Promise.all(resourceIds.map((r) => assertResource(userId, r)));
}

export async function assertItem(userId: string, itemId: string) {
	const rows = await db.items.find({ where: { id: itemId, userId } });
	if (rows.length === 0) error("NOT_FOUND", `item ${itemId}`);
}

export function stripUserId<T extends { userId?: string }>(patch: T): Omit<T, "userId"> {
	const { userId: _r, ...rest } = patch;
	return rest;
}

/** Colonne impostate dal server / DB sulle create: non vanno mandate nel body RPC. */
export const OMIT_CREATE_ROW_KEYS = ["userId", "id", "createdAt", "updatedAt", "deletedAt"] as const;
