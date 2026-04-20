import { v } from "../core/client/validator";
import { table } from "../core/db/schema/table";

// "UPDATED AT" & "CREATED AT" ARE AUTOMATICALLY ADDED

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
// BOOKING
// ───────────────────────────────────────────────────────────────────────────────
const bookingOthers = v.object({});
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
const itemOthers = v.object({});

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
  active: v.boolean(),
  others: itemOthers,
});
