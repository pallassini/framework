import { v } from "../../core/client/validator";
import { schema } from "../../core/db/schema/namespace";
import { table } from "../../core/db/schema/table";

const durationValue = v.object({
  value: v.number(),
  unit: v.enum(["minute", "hour", "day"]),
});

const itemShared = {
  booking: v.optional(
    v.object({
      mode: v.enum(["single", "multi", "delivery"]).default("single"),
      peopleStep: v.object({
        need: v.boolean(),
        min: v.number().optional(),
        max: v.number().optional(),
      }),
    }),
  ),
  duration: durationValue, // durata operativa
  displayedDuration: v.optional(durationValue), // durata mostrata al cliente
  capacity: v.number().optional(),
  resources: v.array(v.fk("resources")).optional(),
};

// ───────────────────────────────────────────────────────────────────────────────
// ITEM CATEGORIES
// ───────────────────────────────────────────────────────────────────────────────
export const itemCategories = table({
  name: v.string(),
  order: v.number().optional(),
  bookerCategory: v.boolean(),
  ...itemShared,
  userId: "users",
});

// ───────────────────────────────────────────────────────────────────────────────
// ITEMS
// ───────────────────────────────────────────────────────────────────────────────
export const items = table({
  name: v.string(),
  description: v.string().optional(),
  image: v.optional(
    v.object({
      mime: v.string(),
      base64: v.string(),
    }),
  ),
  ...itemShared,
  categoryId: v.fk("itemCategories").optional(),
  price: v.number().optional(),
  relations: v
    .array(
      v.object({
        itemId: v.fk("items"),
        kind: v.enum(["upSell", "crossSell", "component"]),
      }),
    )
    .optional(),
  standalone: v.boolean(),
  userId: "users",
});

export const item = schema([items, itemCategories]);
