import { v } from "../core/client/validator";
import { schema } from "../core/db/schema/namespace";
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
  //CUSTOMER
  customerId: v.fk("users").optional(),
  //DATE TIME
  startAt: v.datetime(),
  endAt: v.datetime(),
  //STATUS
  status: v.enum(["pending", "confirmed", "cancelled", "done"]),
  //ITEMS & PRICING
  items: v.array(
    v.object({
      itemId: v.fk("items"),
      price: v.number().optional(), // prezzo congelato per riga
    }),
  ),
  //RESOURCES ASIGNED
  assignments: v.array(v.fk("resources")).optional(),
  others: bookingOthers,
});

// ───────────────────────────────────────────────────────────────────────────────
// ITEM CATEGORY
// ───────────────────────────────────────────────────────────────────────────────
export const itemCategories = table({
  name: v.string(),
  order: v.number().optional(),   // drag-to-reorder nel menu
});

// ───────────────────────────────────────────────────────────────────────────────
// ITEM
// ───────────────────────────────────────────────────────────────────────────────
export const items = table({
  name: v.string(),
  description: v.string().optional(),
  categoryId: v.fk("itemCategories").optional(),
  price: v.number().optional(),
  duration: v.number().optional(),                   // MINUTI
  capacity: v.number(),                              // Quanto occupa sulla risorsa (1 persona, 4 per tavolo da 4, 0 = asporto)
  resources: v.array(v.fk("resources")).optional(),  // Pool di risorse candidate per erogare questo item.
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

// ───────────────────────────────────────────────────────────────────────────────
// SCHEMAS (namespaces) 
// ───────────────────────────────────────────────────────────────────────────────
export const auth = schema([users, sessions]);
export const availability = schema([openingHours, closures]);
export const item = schema([items, itemCategories]);
export const resource = schema([resources]);
export const scheduling = schema([bookings, availability, resource, item]);