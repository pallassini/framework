import { db } from "db";
import { error, s, v } from "server";

type PublicBookingLine = { itemId?: string; quantity?: number };
type BookingMode = "single" | "multi" | "delivery";

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

async function resolveTenantUserId(host: string): Promise<string> {
	const users = await db.users.find({ where: { role: "user" } });
	if (users.length === 0) error("NOT_FOUND", "Nessun tenant disponibile");
	const byUsername = users.find((u: any) => typeof u.username === "string" && cleanHost(u.username) === host);
	if (byUsername) return byUsername.id;
	const byEmailDomain = users.find((u: any) => {
		if (typeof u.email !== "string") return false;
		return cleanHost(u.email.split("@")[1] ?? "") === host;
	});
	if (byEmailDomain) return byEmailDomain.id;
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
		const userId = await resolveTenantUserId(host);

		const [items, allResources, openingHours, closures, bookings] = await Promise.all([
			db.items.find({ where: { userId } }),
			db.resources.find({ where: { userId } }),
			db.openingHours.find({ where: { userId } }),
			db.closures.find({ where: { userId } }),
			db.bookings.find({ where: { userId } }),
		]);

		const nowMs = Date.now();
		const activeBookings = bookings.filter((b: any) => {
			if (b.status === "cancelled") return false;
			const endMs = new Date(b.endAt as Date).getTime();
			return Number.isFinite(endMs) && endMs >= nowMs;
		});

		const reservationsByItem = new Map<string, Map<string, number>>();
		for (const b of activeBookings as any[]) {
			const startAtIso = new Date(b.startAt as Date).toISOString();
			const endAtIso = new Date(b.endAt as Date).toISOString();
			const lines = Array.isArray(b.items) ? (b.items as PublicBookingLine[]) : [];
			for (const line of lines) {
				const itemId = typeof line.itemId === "string" ? line.itemId : "";
				if (!itemId) continue;
				const qty = typeof line.quantity === "number" && Number.isFinite(line.quantity) ? Math.max(1, line.quantity) : 1;
				const slotKey = `${startAtIso}|${endAtIso}`;
				const slotMap = reservationsByItem.get(itemId) ?? new Map<string, number>();
				slotMap.set(slotKey, (slotMap.get(slotKey) ?? 0) + qty);
				reservationsByItem.set(itemId, slotMap);
			}
		}

		const serviceRows = items
			.filter((it: any) => it.archived !== true)
			.map((it: any) => {
				const resourceIds = Array.isArray(it.resources)
					? it.resources.filter((id: unknown): id is string => typeof id === "string" && id.length > 0)
					: [];
				const linkedResources = allResources.filter((r: any) => resourceIds.includes(r.id));
				const resourceCapacity = linkedResources.reduce((sum: number, r: any) => sum + (typeof r.capacity === "number" ? r.capacity : 1), 0);
				const capacity = Math.max(1, (typeof it.capacity === "number" ? it.capacity : resourceCapacity) || 1);
				const hasOpening = openingHours.some((o: any) => o.itemId === it.id || o.itemId == null);
				const serviceOpeningHours = openingHours
					.filter((o: any) => (o.itemId == null || o.itemId === it.id) && (o.resourceId == null || resourceIds.includes(o.resourceId)))
					.map((o: any) => ({
						dayOfWeek: o.dayOfWeek,
						startTime: o.startTime,
						endTime: o.endTime,
						resourceId: o.resourceId ?? null,
					}));
				const serviceClosures = closures
					.filter((c: any) => c.resourceId == null || resourceIds.includes(c.resourceId))
					.map((c: any) => ({
						startAt: new Date(c.startAt as Date).toISOString(),
						endAt: new Date(c.endAt as Date).toISOString(),
						resourceId: c.resourceId ?? null,
					}));
				const serviceReservations = [...(reservationsByItem.get(it.id)?.entries() ?? [])].map(([slot, reserved]) => {
					const [startAt, endAt] = slot.split("|");
					return { startAt, endAt, quantity: reserved };
				});
				const bookingMode: BookingMode =
					it.bookingMode === "multi" || it.bookingMode === "delivery" ? it.bookingMode : "single";
				return {
					id: it.id,
					name: it.name,
					bookingMode,
					duration: typeof it.duration === "number" ? it.duration : null,
					price: typeof it.price === "number" ? it.price : null,
					capacity,
					bookable: hasOpening && capacity > 0,
					resources: resourceIds,
					openingHours: serviceOpeningHours,
					closures: serviceClosures,
					reservations: serviceReservations,
				};
			});

		const q = service?.trim();
		const services = q ? serviceRows.filter((s) => s.id === q || s.name === q) : serviceRows;

		return { services };
	},
});
