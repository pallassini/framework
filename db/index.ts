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

// BOOKING
const bookingOthers = v.object({});
export const bookings = table({
  date: v.datetime(),
  items: v.array(
    v.object({
      itemId: v.fk("items"),
      price: v.number().optional(),
    }),
  ),
  others: bookingOthers,
});

// ITEM
const itemOthers = v.object({});

export const items = table({
  name: v.string(),
  description: v.string().optional(),
  price: v.number().optional(),
  type: v.enum(["normal", "bundle"]),
  parentItemId: v.fk("items").optional(),
  relations: v
    .array(
      v.object({
        itemId: v.fk("items"),
        kind: v.enum(["upSell", "crossSell"]),
      }),
    )
    .optional(),
  others: itemOthers,
  active: v.boolean(),
});
