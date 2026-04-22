import { RESTAURANT_PRESET } from "./restaurant";
import { Preset, PresetType } from "./type";

export const PRESETS: Record<PresetType, Preset> = {
  restaurant: RESTAURANT_PRESET,

};

export const preset: Preset = PRESETS["restaurant"];
