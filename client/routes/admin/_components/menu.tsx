import { For, persistState, state } from "client";
import type { Icon } from "../../../../core/client/runtime/tag/tags/icon";

export const tab = persistState<"prenotations" | "services" | "resources">("resources");

export default function AdminMenu() {
  const open = state(false);
  const items = [
    { label: "Prenotazioni", icon: "calendar", id: "prenotations" },
    { label: "Servizi", icon: "box", id: "services" },
    { label: "Risorse", icon: "users", id: "resources" },
  ];

  return (
    <div s="h-100 w-7 pl-4 mt-40 gapy-5 col hover:(w-10) " hover={open}>
      <For each={items}>
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
                tab() === item.id ? { color: "background", blur: 1, intensity: 3 } : false
              }
            />
            <t show={open()} s="text-4 centery">
              {item.label}
            </t>
          </div>
        )}
      </For>
    </div>
  );
}
