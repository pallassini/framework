import { For, persistState, state } from "client";
import type { Icon } from "../../../../core/client/runtime/tag/tags/icon";

export const tab = persistState<
  "prenotations" | "services" | "resources" | "settings"
>("resources");

const MENU_ITEMS = [
  { label: "Prenotazioni", icon: "calendar", id: "prenotations" as const },
  { label: "Servizi", icon: "box", id: "services" as const },
  { label: "Risorse", icon: "users", id: "resources" as const },
  { label: "Impostazioni", icon: "bolt", id: "settings" as const },
];

export default function AdminMenu() {
  const open = state(false);

  return (
    <div s="px-4 col  h-100 hover:(pr-10)" hover={open}>
    <div s='mt-40 gapy-5 col'>
      <For each={MENU_ITEMS}>
        {(item) => (
          <div
            s={{
              base: {
                "text-7 row round-30px bg-secondary w-auto p-3 gapx-2 font-6": true,
                "hover:(bg-#222222)": true,
                "text-background bg-primary hover:(bg-primary)": [tab, item.id],
              },
            }}
            click={() => tab(item.id as any)}
          >
            <icon
              name={item.icon as Icon}
              shadow={() =>
                tab() === item.id ? { color: "background", blur: 2, intensity: 1 } : false
              }
            />
            <t show={open} s="text-4 centery">
              {item.label}
            </t>
          </div>
        )}
      </For>
    </div>
    </div>
  );
}
