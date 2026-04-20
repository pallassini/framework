import { db } from "db";
import { error, s, v } from "server";

/**
 * Superficie minima per il booker:
 *
 * - catalog         → dati UI (items, resources, promotions attivi)
 * - availability    → orari ricorrenti + chiusure
 * - bookingCreate   → crea prenotazione (prezzi congelati; assegnazione risorse pool-based)
 * - bookingList     → calendario / range temporale (con join FK via `select`)
 * - bookingSetStatus → conferma / annulla / completa
 * - bookingCancel   → shortcut `setStatus("cancelled")`
 *
 * Tutte le `find` usano la nuova API object-form:
 *   db.table.find({
 *     where: { field: value | { $gte: … } },
 *     select: ["id", "fkField.name", …],
 *     orderBy: "field",
 *     direction: "asc" | "desc",
 *     limit, offset,
 *   })
 */

// ─────────────────────────────────────────────────────────────────────────────
// READ
// ─────────────────────────────────────────────────────────────────────────────

/** Catalogo per schermata prenotazione (solo record attivi). */
export const catalog = s({
	run: async () => {
		const [items, resources, promotions] = await Promise.all([
			db.items.find({ where: { active: true } }),
			db.resources.find({ where: { active: true } }),
			db.promotions.find({ where: { active: true } }),
		]);
		return { items, resources, promotions };
	},
});

/** Orari apertura + chiusure (nessun filtro: la logica di validità è applicata a monte). */
export const availability = s({
	run: async () => {
		const [openingHours, closures] = await Promise.all([
			db.openingHours.find(),
			db.closures.find(),
		]);
		return { openingHours, closures };
	},
});

// ─────────────────────────────────────────────────────────────────────────────
// BOOKING CREATE
// ─────────────────────────────────────────────────────────────────────────────

const bookingLineInput = v.object({ itemId: v.fk("items") });

export const bookingCreate = s({
	input: v.object({
		startAt: v.datetime(),
		endAt: v.datetime(),
		items: v.array(bookingLineInput),
		customerId: v.fk("users").optional(),
		promotionId: v.fk("promotions").optional(),
	}),
	run: async (input, ctx) => {
		if (input.endAt.getTime() <= input.startAt.getTime()) {
			error("INPUT", "endAt deve essere dopo startAt");
		}
		if (input.items.length === 0) {
			error("INPUT", "items vuoti");
		}

		const customerId = input.customerId ?? ctx.auth?.userId;

		/**
		 * Ogni item ha un `resources` pool. Assegniamo round-robin il primo slot
		 * libero nel range [startAt, endAt) evitando che la stessa resource venga
		 * scelta due volte nello stesso booking (capacity > 1 non gestita qui:
		 * andrà fatto con un validator di disponibilità sulle sovrapposizioni).
		 */
		const lines: { itemId: string; price?: number }[] = [];
		const alreadyAssigned = new Set<string>();
		const assignments: string[] = [];

		for (const line of input.items) {
			const row = await db.items.byId(line.itemId);
			if (!row || !row.active) error("NOT_FOUND", `Item ${line.itemId}`);
			const price = typeof row.price === "number" ? row.price : undefined;
			lines.push({ itemId: line.itemId, price });

			const pool = row.resources;
			if (!Array.isArray(pool) || pool.length === 0) continue;

			// Prima resource del pool non ancora usata in questo booking.
			const pick = pool.find((r) => !alreadyAssigned.has(r)) ?? pool[0]!;
			alreadyAssigned.add(pick);
			assignments.push(pick);
		}

		// TODO: validare openingHours / closures / sovrapposizioni risorse.

		return db.tx(async (tx) => {
			const created = await db.bookings.create({
				customerId,
				startAt: input.startAt,
				endAt: input.endAt,
				status: "pending",
				items: lines.map((l) => ({ itemId: l.itemId, price: l.price })),
				assignments: assignments.length > 0 ? assignments : undefined,
				promotionId: input.promotionId,
				others: {},
			});
			const booking = created[0];
			if (!booking) error("INTERNAL", "bookings.create non ha ritornato righe");

			// Rollback: cancella la riga appena creata se la transazione fallisce più tardi.
			tx.onRollback(async () => {
				await db.bookings.delete({ where: { id: booking.id } });
			});

			return { booking };
		});
	},
});

// ─────────────────────────────────────────────────────────────────────────────
// BOOKING LIST (calendario)
// ─────────────────────────────────────────────────────────────────────────────

export const bookingList = s({
	input: v.object({
		from: v.datetime(),
		to: v.datetime(),
		/** Se true, richiede sessione e restituisce solo i booking dell'utente corrente. */
		mineOnly: v.boolean().optional(),
		/** Status filter opzionale. */
		status: v.enum(["pending", "confirmed", "cancelled", "done"]).optional(),
	}),
	run: async (input, ctx) => {
		if (input.mineOnly && !ctx.auth?.userId) {
			error("UNAUTHORIZED", "Sessione richiesta per mineOnly");
		}

		const range = {
			$and: [{ startAt: { $lt: input.to } }, { endAt: { $gt: input.from } }],
		} as const;

		const mineClause =
			input.mineOnly && ctx.auth?.userId ? { customerId: ctx.auth.userId } : undefined;

		const statusClause = input.status ? { status: input.status } : undefined;

		const where = {
			$and: [range, ...(mineClause ? [mineClause] : []), ...(statusClause ? [statusClause] : [])],
		};

		/**
		 * Una singola fetch con:
		 *  - booking base
		 *  - customer (solo `name`/`email` del customerId se esistente)
		 *  - nome item per ogni line
		 *  - nome resource per ogni assignment
		 *  - nome promo
		 */
		const bookings = await db.bookings.find({
			where,
			select: [
				"id",
				"startAt",
				"endAt",
				"status",
				"customerId.username",
				"customerId.email",
				"items.itemId.name",
				"items.price",
				"assignments.name",
				"promotionId.name",
				"promotionId.discountPercent",
				"promotionId.discountAmount",
			],
			orderBy: "startAt",
			direction: "asc",
		});

		return { bookings };
	},
});

// ─────────────────────────────────────────────────────────────────────────────
// BOOKING UPDATE
// ─────────────────────────────────────────────────────────────────────────────

export const bookingSetStatus = s({
	input: v.object({
		id: v.string(),
		status: v.enum(["pending", "confirmed", "cancelled", "done"]),
	}),
	run: async (input) => {
		const res = await db.bookings.update({
			where: { id: input.id },
			set: { status: input.status },
		});
		if (res.count === 0) error("NOT_FOUND", "booking");
		return { booking: res.rows[0]! };
	},
});

/** Shortcut comune: `bookingSetStatus` con status="cancelled" e check di proprietà. */
export const bookingCancel = s({
	input: v.object({ id: v.string() }),
	run: async (input, ctx) => {
		const row = await db.bookings.byId(input.id);
		if (!row) error("NOT_FOUND", "booking");
		if (ctx.auth?.userId && row.customerId && row.customerId !== ctx.auth.userId) {
			error("FORBIDDEN", "non puoi cancellare questa prenotazione");
		}
		const res = await db.bookings.update({
			where: { id: input.id },
			set: { status: "cancelled" },
		});
		return { booking: res.rows[0]! };
	},
});
