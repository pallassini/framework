export type PresetType = "restaurant";

// ─── PRESET ─────────────────────────────────────────────────────────────────
export interface Preset {
  type: PresetType;
  name: string;
  theme: "dark" | "light";
  primaryColor: string;

  // CALENDAR 
  calendar: {
    byResource?: boolean;                       // vista con colonne per persona/tavolo
  };

  // RESOURCES
  resources: {
    spaces?: {
      label: string;                            // "Tavoli", "Sale"
      icon: string;
      canCreate?: boolean;
      canEdit?: boolean;
      canDelete?: boolean;
      fields: {
        key: string;                            // "name", "capacity", "description"
        label: string;                          // placeholder mostrato
        type: "string" | "number";
        optional?: boolean;
        min?: number;
      }[];
    };
    persons?: {
      label: string;                            // "Operatori", "Staff"
      icon: string;
      canCreate?: boolean;
      canEdit?: boolean;
      canDelete?: boolean;
      fields: {
        key: string;
        label: string;
        type: "string" | "number";
        optional?: boolean;
        min?: number;
      }[];
    };
  };

  // ITEMS (tab fissa) — per ora niente da configurare, vocabolario al piu
  items: {
    label?: string;                             // "Menu", "Servizi", "Prestazioni"
    icon?: string;
  };
}
