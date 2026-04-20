import { v } from "../core/client/validator";
import { table } from "../core/db/schema/table";

// "UPDATED AT" & "CREATED AT" ARE AUTOMATICALLY ADDED

// ───────────────────────────────────────────────────────────────────────────────
// AUTH
// ───────────────────────────────────────────────────────────────────────────────
export const users = table({
  email: v.string().unique(),
  password: v.string(),
  username: v.string().optional(),
  role: v.enum(["admin", "user"]),
});

export const sessions = table({
  userId: "users",
  expiresAt: v.datetime(),
  revokedAt: v.datetime().optional(),
});

// ───────────────────────────────────────────────────────────────────────────────
// OPENING HOURS
// ───────────────────────────────────────────────────────────────────────────────
// resourceId null = orario del posto (globale). Altrimenti orario della risorsa.
export const openingHours = table({
  resourceId: v.fk("resources").optional(),
  dayOfWeek: v.enum(["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]),
  startTime: v.time(),
  endTime: v.time(),
  validFrom: v.date().optional(),
  validTo: v.date().optional(),
});

// ───────────────────────────────────────────────────────────────────────────────
// CLOSURES
// ───────────────────────────────────────────────────────────────────────────────
// resourceId null = chiusura del posto. Altrimenti ferie/assenza di quella risorsa.
export const closures = table({
  resourceId: v.fk("resources").optional(),
  startAt: v.datetime(),
  endAt: v.datetime(),
});

// ───────────────────────────────────────────────────────────────────────────────
// BOOKING
// ───────────────────────────────────────────────────────────────────────────────
const bookingOthers = v.object({}); // additional fields in the booking
export const bookings = table({
  //DATE TIME
  startAt: v.datetime(),
  endAt: v.datetime(),
  //STATUS
  status: v.enum(["pending", "confirmed", "cancelled", "done"]),
  items: v.array(v.fk("items")),
  others: bookingOthers,
});

// ───────────────────────────────────────────────────────────────────────────────
// ITEM
// ───────────────────────────────────────────────────────────────────────────────
export const items = table({
  name: v.string(),
  description: v.string().optional(),
  price: v.number().optional(),
  duration: v.number().optional(), //MINUTES
  relations: v
    .array(
      v.object({
        itemId: v.fk("items"),
        // COMPONENT: l'item è un pezzo del bundle
        kind: v.enum(["upSell", "crossSell", "component"]),
      }),
    )
    .optional(),
  standalone: v.boolean(), // se false, visibile solo come parte di un bundle
  active: v.boolean(),
});

// ───────────────────────────────────────────────────────────────────────────────
// RESOURCE
// ───────────────────────────────────────────────────────────────────────────────
const resourceOthers = v.object({});
export const resources = table({
  name: v.string(),               // "Luisa", "Sala coperta", "Tavolo 7", "Sala yoga"
  kind: v.string(),                // "operator" | "seats" | "table" | "room" | ...
  capacity: v.number(),            // 1 per persona/tavolo, 80 per sala coperta, ecc.
  description: v.string().optional(),
  active: v.boolean(),             // soft-delete: false = dismessa
  others: resourceOthers,
});