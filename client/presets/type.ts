export type PresetType = "restaurant";

export interface Preset {
  type: PresetType;
  name: string;
  theme: "dark" | "light";
  primaryColor: string;

  // ITEMS
  items: {
    label: string;
    icon: string;
  };

  // RESOURCES
  resources: {
    label: string; // "Spazi", "Persone"
    icon: string;
    // SPACES
    spaces: {
      enabled: boolean;
      spaces?: {
        label: string; // "Tavoli", "Sale"
        icon: string;
        create?: boolean;
        edit?: boolean;
        delete?: boolean;
      };
      // PERSONS
      persons?: {
        label: string; // "Operatori", "Staff"
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
  };
}
