import { For, persistState, state } from "client";

export const tab = persistState<"prenotations" | "services" | "resources">("resources");

export default function AdminMenu() {
  const open = state(false);
  const items = [
    { label: "Prenotazioni", icon: "calendar", id: "prenotations" },
    { label: "Servizi", icon: "box", id: "services" },
    { label: "Risorse", icon: "users", id: "resources" },
  ];

  return (
    <div
      hover={open}
      s={{
        des: "col fixed left h-100vh br-1px br-#1b1b1b w-3vw hover:(w-12vw) duration-300 gapy-8vh pl-0vw pt-20vh bg-background z-1000",
      }}
    >
      <For each={items}>
        {(item) => (
          <div
            s={{
              des: "row children-centery gapx-0.5vw origin-left hover:(bg-#ffffff0a scale-110 ) duration-150 px-0.5vw py-0.5vh mr-1.5vw round-10px",
            }}
            click={() => tab(item.id as any)}
          >
            <icon
              name={item.icon as any}
              size="5"
              s={{ base: {"duration-300": true, "text-primary": [tab, item.id] } }}
              style={{ flexShrink: 0 }}
            />
            <t
              style={{ flexShrink: 0, whiteSpace: "nowrap" }}
              s={() => ({
                base: {"duration-300": true, "text-primary": tab() === item.id },
                des: `font-6 text-5 duration-300 ${open() ? "opacity-100" : "opacity-0"}`,
              })}
            >
              {item.label}
            </t>
          </div>
        )}
      </For>
    </div>
  );
}
