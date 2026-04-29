import { v } from "../../core/client/validator";
import { schema } from "../../core/db/schema/namespace";
import { table } from "../../core/db/schema/table";

// ───────────────────────────────────────────────────────────────────────────────
// USERS
// ───────────────────────────────────────────────────────────────────────────────
const defaultUsers = {
  email: v.string().unique(),
  password: v.string(),
  passwordUpdatedAt: v.datetime(),
  username: v.string().optional(),
};
export const users = table({
  ...defaultUsers,
  role: v.enum(["admin", "user", "customer"]),
  domain: v.string().optional(),
  color: v.string().optional(),
  theme: v.enum(["light", "dark"]).default("dark"),
  companyName: v.string().optional(),
  taxId: v.string().optional(),
  sdiCode: v.string().optional(),
  stripeCustomerId: v.string().optional(),
  stripeSubscriptionId: v.string().optional(),
  subscriptionStatus: v
    .enum(["trialing", "active", "past_due", "canceled", "incomplete"])
    .optional(),
});

// ───────────────────────────────────────────────────────────────────────────────
// SESSIONS
// ───────────────────────────────────────────────────────────────────────────────
export const sessions = table({
  userId: "users",
  expiresAt: v.datetime(),
  revokedAt: v.datetime().optional(),
});

// ───────────────────────────────────────────────────────────────────────────────
// DEVICE
// ───────────────────────────────────────────────────────────────────────────────
export const device = table({
  userId: "users",
  ip: v.string().optional(),
  os: v.string().optional(),
  brand: v.string().optional(),
  model: v.string().optional(),
  browser: v.string().optional(),
  pwa: v.boolean().optional(),
  locale: v.string().optional(),
  tz: v.string().optional(),
  lat: v.number().optional(),
  lng: v.number().optional(),
  width: v.number().optional(),
  height: v.number().optional(),
  dpr: v.number().optional(),
  lastSeenAt: v.datetime().optional(),
});

// ───────────────────────────────────────────────────────────────────────────────
// NOTIFICATION
// ───────────────────────────────────────────────────────────────────────────────
export const notification = table({
  deviceId: "device",
  userId: "users",
  subscription: v.string(),
});

export const auth = schema([users, sessions, device, notification]);
