import { device, For, go, persistState, state, url } from "client";
import { Icon } from "../../../../core/client/runtime/tag/tags/icon";



const MENU_ITEMS = [
  { label: "Dashboard", icon: "monitor", go: ""  },
  { label: "Users", icon: "users", go: "/users" as const },
  { label: "Settings", icon: "bolt", go: "/settings" },

];

export default function AdminMenu() {
  const open = state(false);

  return (
    <switch value={device}>
      <case when="mob">
        <div s="fixed bottom-0 left-0 right-0 bg-background w-100% h-7 z-9999 row children-center gapx-10 bt-#313131be bt-2">
          <For each={MENU_ITEMS}>
            {(item) => (
              <icon
                name={item.icon as Icon}
                s={{
                  base: {
                    "text-7 round-30px p-3 gapx-2 font-6": true,
                    "hover:(bg-#222222)": true,
                    "text-background bg-primary hover:(bg-primary)": url.pathname() === "/admin" + item.go,
                  },
                }}
                stroke={2.5}
                size={9}
                click={() => go("/admin" + item.go)}
              />
            )}
          </For>
        </div>
      </case>
      <case when={(v) => v === "tab" || v === "des"}>
        <div s="px-4 col h-100 hover:(pr-10)" hover={open}>
          <div s="mt-40 gapy-5 col">
            <For each={MENU_ITEMS}>
              {(item) => (
                <div
                  s={{
                    base: {
                      "text-7 row round-30px bg-secondary w-auto p-3 gapx-2 font-6": true,
                      "hover:(bg-#222222)": true,
                      "text-background bg-primary hover:(bg-primary)": url.pathname() === "/admin" + item.go,
                    },
                  }}
                  click={() => go("/admin" + item.go)}
                >
                  <icon
                    name={item.icon as Icon}
                    shadow={() =>
                      url.pathname() === "/admin" + item.go ? { color: "background", blur: 2, intensity: 1 } : false
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
      </case>
    </switch>
  );
}
