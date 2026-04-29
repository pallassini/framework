import { v } from "../../core/client/validator";
import { schema } from "../../core/db/schema/namespace";
import { table } from "../../core/db/schema/table";

// ───────────────────────────────────────────────────────────────────────────────
// BOOKINGS
// ───────────────────────────────────────────────────────────────────────────────
export const bookings = table({
  startAt: v.datetime(),
  endAt: v.datetime(),
  status: v.enum(["pending", "confirmed", "cancelled", "done"]),
  items: v.array(
    v.object({
      itemId: v.fk("items"),
      price: v.number().optional(),
    }),
  ),
  resources: v.array(v.fk("resources")).optional(),
  customerId: v.fk("users").optional(),
  userId: "users",
});

export const booking = schema([bookings]);
