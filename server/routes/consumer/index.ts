import { db } from "db";
import { error, s, v } from "server";

type BookingMode = "single" | "multi" | "delivery";

function normalizeBooking(raw: unknown): {
	mode: BookingMode;
	peopleStep: { need: boolean; min: number | null; max: number | null };
} {
	const b = raw as
		| {
				mode?: unknown;
				peopleStep?: { need?: unknown; min?: unknown; max?: unknown };
		  }
		| undefined;
	const mode: BookingMode = b?.mode === "multi" || b?.mode === "delivery" ? b.mode : "single";
	const ps = b?.peopleStep;
	return {
		mode,
		peopleStep: {
			need: ps?.need === true,
			min: typeof ps?.min === "number" ? ps.min : null,
			max: typeof ps?.max === "number" ? ps.max : null,
		},
	};
}

const cleanHost = (raw: string) => raw.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, "");

function hostFromHeaders(headers: Headers): string | null {
	for (const h of ["origin", "referer"] as const) {
		const val = headers.get(h);
		if (!val) continue;
		try {
			return cleanHost(new URL(val).host);
		} catch {
			/* ignore invalid url */
		}
	}
	const forwarded = headers.get("x-forwarded-host");
	if (forwarded) return cleanHost((forwarded.split(",")[0] ?? "").trim());
	const host = headers.get("host");
	return host ? cleanHost(host) : null;
}

function rowUsername(u: { username?: unknown }): string | null {
	return typeof u.username === "string" && u.username.length > 0 ? u.username : null;
}

async function resolveTenant(host: string): Promise<{ userId: string; username: string | null }> {
	const users = await db.users.find({ where: { role: "user" } });
	if (users.length === 0) error("NOT_FOUND", "Nessun tenant disponibile");
	const byUsername = users.find((u: any) => typeof u.username === "string" && cleanHost(u.username) === host);
	if (byUsername) return { userId: byUsername.id, username: rowUsername(byUsername) };
	const byDomain = users.find((u: any) => typeof u.domain === "string" && cleanHost(u.domain) === host);
	if (byDomain) return { userId: byDomain.id, username: rowUsername(byDomain) };
	const byEmailDomain = users.find((u: any) => {
		if (typeof u.email !== "string") return false;
		return cleanHost(u.email.split("@")[1] ?? "") === host;
	});
	if (byEmailDomain) return { userId: byEmailDomain.id, username: rowUsername(byEmailDomain) };
	error("NOT_FOUND", `Tenant non trovato per host: ${host}`);
}

export default s({
	auth: false,
	input: v.object({
		service: v.string().optional(),
	}),
	run: async ({ service }, ctx) => {
		const host = hostFromHeaders(ctx.headers);
		if (!host) error("INPUT", "Host richiesta non valido");
		const { userId, username } = await resolveTenant(host);

		const [items, allResources, openingHours, closures, bookings, itemCategories, resourceGroups] = await Promise.all([
			db.items.find({ where: { userId } }),
			db.resources.find({ where: { userId } }),
			db.openingHours.find({ where: { userId } }),
			db.closures.find({ where: { userId } }),
			db.bookings.find({ where: { userId } }),
			db.itemCategories.find({ where: { userId } }),
			db.resourceGroups.find({ where: { userId } }),
		]);

		const itemCategoriesList = itemCategories
			.map((c: any) => ({
				id: c.id,
				name: c.name,
				order: typeof c.order === "number" ? c.order : null,
			}))
			.sort((a, b) => {
				const oa = a.order ?? 1e9;
				const ob = b.order ?? 1e9;
				if (oa !== ob) return oa - ob;
				return a.name.localeCompare(b.name);
			});

		const categoryById = new Map(itemCategoriesList.map((c) => [c.id, c]));
		const resourceGroupsList = resourceGroups
			.map((g: any) => ({
				id: g.id,
				name: g.name,
				order: typeof g.order === "number" ? g.order : null,
			}))
			.sort((a, b) => {
				const oa = a.order ?? 1e9;
				const ob = b.order ?? 1e9;
				if (oa !== ob) return oa - ob;
				return a.name.localeCompare(b.name);
			});
		const resourceGroupById = new Map(resourceGroupsList.map((g) => [g.id, g]));

		const nowMs = Date.now();
		const activeBookings = bookings.filter((b: any) => {
			if (b.status === "cancelled") return false;
			const endMs = new Date(b.endAt as Date).getTime();
			return Number.isFinite(endMs) && endMs >= nowMs;
		});

		const reservationsByResource = new Map<string, Map<string, number>>();
		for (const b of activeBookings as any[]) {
			const startAtIso = new Date(b.startAt as Date).toISOString();
			const endAtIso = new Date(b.endAt as Date).toISOString();
			const slotKey = `${startAtIso}|${endAtIso}`;
			const assigned = Array.isArray(b.assignments)
				? b.assignments.filter((id: unknown): id is string => typeof id === "string" && id.length > 0)
				: [];
			for (const resourceId of assigned) {
				const slotMap = reservationsByResource.get(resourceId) ?? new Map<string, number>();
				slotMap.set(slotKey, (slotMap.get(slotKey) ?? 0) + 1);
				reservationsByResource.set(resourceId, slotMap);
			}
		}

		const globalOpeningHours = openingHours
			.filter((o: any) => o.itemId == null && o.resourceId == null)
			.map((o: any) => ({
				dayOfWeek: o.dayOfWeek,
				startTime: o.startTime,
				endTime: o.endTime,
			}));

		const resources = allResources.map((r: any) => ({
			id: r.id,
			name: r.name,
			type: r.type,
			groupId: typeof r.groupId === "string" && r.groupId.length > 0 ? r.groupId : null,
			group:
				typeof r.groupId === "string" && r.groupId.length > 0
					? (resourceGroupById.get(r.groupId) ?? null)
					: null,
			capacity: typeof r.capacity === "number" ? r.capacity : 1,
			reservations: [...(reservationsByResource.get(r.id)?.entries() ?? [])].map(([slot, quantity]) => {
				const [startAt, endAt] = slot.split("|");
				return { startAt, endAt, quantity };
			}),
		}));

		const serviceRows = items
			.filter((it: any) => it.archived !== true)
			.map((it: any) => {
				const resourceIds = Array.isArray(it.resources)
					? it.resources.filter((id: unknown): id is string => typeof id === "string" && id.length > 0)
					: [];
				const linkedResources = allResources.filter((r: any) => resourceIds.includes(r.id));
				const resourceCapacity = linkedResources.reduce((sum: number, r: any) => sum + (typeof r.capacity === "number" ? r.capacity : 1), 0);
				const capacity = Math.max(1, (typeof it.capacity === "number" ? it.capacity : resourceCapacity) || 1);
				const serviceOpeningHours = openingHours
					.filter((o: any) => (o.itemId == null || o.itemId === it.id) && (o.resourceId == null || resourceIds.includes(o.resourceId)))
					.map((o: any) => ({
						dayOfWeek: o.dayOfWeek,
						startTime: o.startTime,
						endTime: o.endTime,
						resourceId: o.resourceId ?? null,
					}));
				const serviceSpecificOpeningHours = serviceOpeningHours.filter((o) => o.resourceId != null || openingHours.some((x: any) => x.itemId === it.id && x.startTime === o.startTime && x.endTime === o.endTime && x.dayOfWeek === o.dayOfWeek));
				const serviceClosures = closures
					.filter((c: any) => c.resourceId == null || resourceIds.includes(c.resourceId))
					.map((c: any) => ({
						startAt: new Date(c.startAt as Date).toISOString(),
						endAt: new Date(c.endAt as Date).toISOString(),
						resourceId: c.resourceId ?? null,
					}));
				const booking = normalizeBooking(it.booking);
				const categoryId = typeof it.categoryId === "string" && it.categoryId.length > 0 ? it.categoryId : null;
				const itemCategory = categoryId ? (categoryById.get(categoryId) ?? null) : null;
				return {
					id: it.id,
					name: it.name,
					description: typeof it.description === "string" ? it.description : null,
					categoryId,
					itemCategory,
					booking,
					duration: typeof it.duration === "number" ? it.duration : null,
					price: typeof it.price === "number" ? it.price : null,
					capacity,
					resources: resourceIds,
					globalOpeningHours,
					serviceOpeningHours: serviceSpecificOpeningHours,
					closures: serviceClosures,
				};
			});

		const q = service?.trim();
		const services = q ? serviceRows.filter((s) => s.id === q || s.name === q) : serviceRows;

		return {
			services,
			resources,
			itemCategories: itemCategoriesList,
			resourceGroups: resourceGroupsList,
			username,
		};
	},
});
