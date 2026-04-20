import { For, state } from "client";

export default function AdminMenu() {
  const open = state(false);
  const items = [
    { label: "Prenotazioni", icon: "calendar" },
    { label: "Servizi", icon: "box" },
    { label: "Risorse", icon: "users" },
  ];

  return (
    <div
      hover={open}
      s={{
        des: "col left h-100vh br-1px br-#414141 w-3vw hover:(w-12vw) duration-300 gapy-8vh pl-0vw pt-20vh",
      }}
    >
      <For each={items}>
        {(item) => (
          <div
            s={{ des: "row children-centery gapx-0.5vw origin-left hover:(bg-#ffffff0a scale-110 ) duration-150 px-0.5vw py-0.5vh mr-1.5vw round-10px" }}
          >
            <icon name={item.icon as any} size="5" style={{ flexShrink: 0 }} />
            <t
              style={{ flexShrink: 0, whiteSpace: "nowrap" }}
              s={() => ({
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
