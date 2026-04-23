import { v, type InferSchema } from "../../core/client/validator";
export const preset = v.enum(["restaurant", "dentist"]);
export type PresetType = InferSchema<typeof preset>;

export interface Preset {
  type: PresetType;

  // RESOURCES
  resources: "space" | "person";
}
