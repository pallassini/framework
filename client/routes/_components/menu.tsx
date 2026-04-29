import { device, For, go, routePhase, state, url } from "client";
import { Icon } from "../../../core/client/runtime/tag/tags/icon";



const MENU_ITEMS = [
  { label: "Prenotazioni", icon: "calendarCheck", go: ""  },
  { label: "Servizi", icon: "layout", go: "services" },
  { label: "Risorse", icon: "users", go: "resources" },
  { label: "Calendario", icon: "calendarClock", go: "calendar" },
  { label: "Impostazioni", icon: "bolt", go: "settings" }
];

/** Path assoluto root: `""` → `"/"`, altrimenti `"/" + go`. */
function menuHref(go: string): string {
  return go ? `/${go}` : "/";
}

/** Stesso criterio del router, tollera slash finale. */
function menuIsActive(go: string): boolean {
  void routePhase();
  const cur = url.route();
  const target = menuHref(go);
  const a = (cur.replace(/\/$/, "") || "/") as string;
  const b = (target.replace(/\/$/, "") || "/") as string;
  return a === b;
}

export default function Menu() {
  const open = state(false);

  return (
    <switch value={device}>
      <case when="mob">
        <div s="fixed bottom-0 left-0 right-0 bg-background w-100% h-7 z-9999 row children-center gapx-10 bt-#313131be bt-2">
          <For each={MENU_ITEMS}>
            {(item) => (
              <icon
                name={item.icon as Icon}
                s={() => ({
                  base: {
                    "text-7 round-15px p-2 gapx-2 font-6": true,
                    "hover:(bg-#222222)": true,
                    "text-background bg-primary hover:(bg-primary)": menuIsActive(item.go),
                  },
                })}
                stroke={2.5}
                size={8}
                click={() => go(menuHref(item.go))}
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
                  s={() => ({
                    base: {
                      "text-7 row round-30px bg-secondary w-auto p-3 gapx-2 font-6": true,
                      "hover:(bg-#222222)": true,
                      "text-background bg-primary hover:(bg-primary)": menuIsActive(item.go),
                    },
                  })}
                  click={() => go(menuHref(item.go))}
                >
                  <icon
                    name={item.icon as Icon}
                    shadow={() =>
                      menuIsActive(item.go) ? { color: "background", blur: 2, intensity: 1 } : false
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
