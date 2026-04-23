import type { Preset, PresetType } from "./type";

export const PRESETS: Record<PresetType, Preset> = {
  restaurant: {
    type: "restaurant",
    resources: "space",
  },
  dentist: {
    type: "dentist",
    resources: "person",
  },
};
