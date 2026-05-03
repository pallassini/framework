import { v } from "../../core/client/validator";
import { schema } from "../../core/db/schema/namespace";
import { table } from "../../core/db/schema/table";

const resourceShared = {
  capacity: v.number().optional(),
  type: v.enum(["space", "person"]),
};

// ───────────────────────────────────────────────────────────────────────────────
// RESOURCES
// ───────────────────────────────────────────────────────────────────────────────
export const resources = table({
  name: v.string(),
  ...resourceShared,
  groupId: v.fk("resourceCategories").optional(),
  userId: "users",
});

// ───────────────────────────────────────────────────────────────────────────────
// RESOURCE CATEGORIES
// ───────────────────────────────────────────────────────────────────────────────
export const resourceCategories = table({
  name: v.string(),
  ...resourceShared,
  userId: "users",
});

export const resource = schema([resources, resourceCategories]);
