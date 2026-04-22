import type { Preset, PresetType } from "./type";

export const PRESETS: Record<PresetType, Preset> = {
  restaurant: {
    type: "restaurant",
    items: {
      label: "Items",
      icon: "items",
    },
    resources: {
      kind: "space",
    },
  },
};
