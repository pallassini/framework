import { db } from "db";
import { error } from "server";
import type { ServerContext } from "../../../core/server/routes/context";

export function uid(ctx: ServerContext): string {
	const id = ctx.user?.id ?? ctx.auth?.userId;
	if (!id) error("UNAUTHORIZED", "Session required");
	return id;
}

export async function assertItemCategory(
	tenant: string,
	categoryId: string | undefined | null,
): Promise<void> {
	if (categoryId == null) return;
	const rows = await db.itemCategories.find({ where: { id: categoryId, userId: tenant } });
	if (rows.length === 0) error("NOT_FOUND", `itemCategory ${categoryId}`);
}

export async function assertResource(
	tenant: string,
	resourceId: string | undefined | null,
): Promise<void> {
	if (resourceId == null) return;
	const rows = await db.resources.find({ where: { id: resourceId, userId: tenant } });
	if (rows.length === 0) error("NOT_FOUND", `resource ${resourceId}`);
}

export async function assertResources(tenant: string, resourceIds: readonly string[] | undefined | null) {
	if (resourceIds == null) return;
	await Promise.all(resourceIds.map((r) => assertResource(tenant, r)));
}

export async function assertItem(tenant: string, itemId: string) {
	const rows = await db.items.find({ where: { id: itemId, userId: tenant } });
	if (rows.length === 0) error("NOT_FOUND", `item ${itemId}`);
}

export function stripUserId<T extends { userId?: string }>(patch: T): Omit<T, "userId"> {
	const { userId: _r, ...rest } = patch;
	return rest;
}
