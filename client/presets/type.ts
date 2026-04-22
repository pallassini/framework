import { v, type InferSchema } from "client";

export const preset = v.enum(["restaurant"]);
export type PresetType = InferSchema<typeof preset>;

export interface Preset {
  type: PresetType;

  // ITEMS
  items: {
    label: string;
    icon: string;
  };

  // RESOURCES
  resources: {
    kind: "space" | "person";
  };
}
