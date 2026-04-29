import { v } from "../../core/client/validator";
import { schema } from "../../core/db/schema/namespace";
import { table } from "../../core/db/schema/table";
// ───────────────────────────────────────────────────────────────────────────────
// OPENING HOURS
// ───────────────────────────────────────────────────────────────────────────────
export const openingHours = table({
  resourceId: v.fk("resources").optional(),
  itemId: v.fk("items").optional(),
  dayOfWeek: v.enum(["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]),
  startTime: v.time(),
  endTime: v.time(),
  userId: "users",
});

// ───────────────────────────────────────────────────────────────────────────────
// CLOSURES
// ───────────────────────────────────────────────────────────────────────────────
export const closures = table({
  resourceId: v.fk("resources").optional(),
  itemId: v.fk("items").optional(),
  startAt: v.datetime(),
  endAt: v.datetime(),
  userId: "users",
});

export const availability = schema([openingHours, closures]);
